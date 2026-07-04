import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Logger } from '../utils/logger';
import { orchestrateTurn } from './orchestrator';
import { generateVoiceResponse } from './responseGenerator';
import { getSessionState, clearSessionState } from './stateManager';
import prisma from '../config/prisma';
import { broadcastToDashboard } from './eventHub';
import { synthesizeSpeech } from './elevenLabsService';

/**
 * handleSession — Browser-to-backend real-time voice session handler.
 *
 * Protocol:
 *   Browser → Server:  Binary frames (webm/opus audio chunks from MediaRecorder)
 *   Browser → Server:  JSON { type: "stop" }
 *
 *   Server → Browser:  JSON { type: "status", status: "connecting"|"listening"|"thinking"|"speaking" }
 *   Server → Browser:  JSON { type: "transcript", text, isFinal, speaker }
 *   Server → Browser:  JSON { type: "ai_response", text }
 *   Server → Browser:  Binary frames (MP3 audio from ElevenLabs)
 *   Server → Browser:  JSON { type: "audio_end" }
 *   Server → Browser:  JSON { type: "error", message }
 */
export const handleSession = (ws: WebSocket, req?: IncomingMessage): void => {
  const urlObj = new URL(req?.url || '', `http://${req?.headers.host || 'localhost'}`);
  const sessionId = urlObj.searchParams.get('sessionId') || `session-${Date.now()}`;
  const participantName = urlObj.searchParams.get('participantName') || 'Patient';

  Logger.info(`Browser voice session connected — sessionId: ${sessionId} — participant: ${participantName}`, 'SESSION');

  const send = (payload: object): void => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  };

  let hospitalId = '';
  let isProcessing = false;
  let audioChunkCount = 0;

  // Resolve hospital ID from database
  prisma.hospital.findFirst()
    .then((hospital) => {
      if (hospital) {
        hospitalId = hospital.id;
        Logger.info(`Session resolved hospital: ${hospital.name} (${hospital.id})`, 'SESSION');
      }
    })
    .catch((err) => Logger.error('Failed to resolve hospital ID', err, 'SESSION'));

  // ── Deepgram STT Connection ────────────────────────────────────────────────
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramApiKey) {
    Logger.error('DEEPGRAM_API_KEY not configured — cannot start session.', null, 'SESSION');
    send({ type: 'error', message: 'Speech-to-text service not available. Please configure DEEPGRAM_API_KEY.' });
    ws.close();
    return;
  }

  // Use auto-detect encoding (browser sends webm/opus — Deepgram handles it)
  const deepgramUrl = 'wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&interim_results=true&smart_format=true&endpointing=400';
  const deepgramWs = new WebSocket(deepgramUrl, {
    headers: { Authorization: `Token ${deepgramApiKey}` },
  });

  let deepgramReady = false;

  deepgramWs.on('open', () => {
    deepgramReady = true;
    Logger.info('Deepgram STT connected for browser session.', 'DEEPGRAM');

    send({ type: 'status', status: 'listening' });

    broadcastToDashboard({
      event: 'call_started',
      callSid: sessionId,
      callerPhone: participantName,
      hospitalPhone: '',
      timestamp: new Date().toISOString(),
    });
    broadcastToDashboard({ event: 'ai_status_change', callSid: sessionId, status: 'listening' });
  });

  deepgramWs.on('message', (rawMsg: Buffer | string) => {
    try {
      const response = JSON.parse(rawMsg.toString());
      const transcript: string = response.channel?.alternatives?.[0]?.transcript || '';
      const isFinal: boolean = response.is_final === true;

      if (!transcript.trim()) return;

      // Forward transcript to browser
      send({ type: 'transcript', text: transcript, isFinal, speaker: 'patient' });

      // Broadcast to live-calls dashboard
      broadcastToDashboard({
        event: 'transcript_received',
        callSid: sessionId,
        transcript,
        isFinal,
        speaker: 'patient',
        timestamp: new Date().toISOString(),
      });

      if (isFinal && !isProcessing) {
        isProcessing = true;
        Logger.info(`Patient [${sessionId}]: "${transcript}"`, 'SESSION');

        send({ type: 'status', status: 'thinking' });
        broadcastToDashboard({ event: 'ai_status_change', callSid: sessionId, status: 'thinking' });

        // ── AI Pipeline: Orchestrator → Response Generator → TTS ──────────
        orchestrateTurn(sessionId, transcript, hospitalId, participantName)
          .then(async (orchestratorResult) => {
            Logger.info(`Orchestrator: ${orchestratorResult.selected_tool} — ${orchestratorResult.reason}`, 'SESSION');

            const sessionState = getSessionState(sessionId);

            broadcastToDashboard({
              event: 'tool_executed',
              callSid: sessionId,
              tool: orchestratorResult.selected_tool,
              reason: orchestratorResult.reason,
              result: orchestratorResult.result,
              state: sessionState,
            });

            // Generate natural language response
            const voiceResponse = await generateVoiceResponse(transcript, sessionState, orchestratorResult);
            Logger.info(`AI [${sessionId}]: "${voiceResponse}"`, 'SESSION');

            // Send text response
            send({ type: 'ai_response', text: voiceResponse });
            broadcastToDashboard({
              event: 'ai_response_generated',
              callSid: sessionId,
              response: voiceResponse,
              speaker: 'ai',
              timestamp: new Date().toISOString(),
            });

            send({ type: 'status', status: 'speaking' });
            broadcastToDashboard({ event: 'ai_status_change', callSid: sessionId, status: 'speaking' });

            // Synthesize and stream audio
            const audioBuffer = await synthesizeSpeech(voiceResponse);
            if (audioBuffer && ws.readyState === WebSocket.OPEN) {
              ws.send(audioBuffer); // Binary audio frame (MP3)
              send({ type: 'audio_end' }); // Signal playback complete
            }

            send({ type: 'status', status: 'listening' });
            broadcastToDashboard({ event: 'ai_status_change', callSid: sessionId, status: 'listening' });
          })
          .catch((err) => {
            Logger.error('AI pipeline error in session handler', err, 'SESSION');
            send({ type: 'error', message: 'AI processing failed. Please try again.' });
            send({ type: 'status', status: 'listening' });
          })
          .finally(() => {
            isProcessing = false;
          });
      }
    } catch (err) {
      Logger.error('Failed to parse Deepgram message', err, 'DEEPGRAM');
    }
  });

  deepgramWs.on('error', (err) => Logger.error('Deepgram WebSocket error', err, 'DEEPGRAM'));
  deepgramWs.on('close', () => Logger.info('Deepgram STT connection closed.', 'DEEPGRAM'));

  // ── Incoming Browser Messages ──────────────────────────────────────────────
  ws.on('message', (data: Buffer | string) => {
    // Control messages (JSON strings)
    if (typeof data === 'string' || (data instanceof Buffer && data[0] === 0x7b /* '{' */)) {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'stop') {
          Logger.info(`Session stop requested by client: ${sessionId}`, 'SESSION');
        }
      } catch { /* ignore parse errors for binary that happens to start with { */ }
      return;
    }

    // Binary audio data (webm/opus from MediaRecorder)
    if (deepgramReady && deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.send(data);
      audioChunkCount++;
    }
  });

  // ── Session Cleanup ────────────────────────────────────────────────────────
  ws.on('close', () => {
    Logger.info(`Browser session disconnected — sessionId: ${sessionId} — chunks: ${audioChunkCount}`, 'SESSION');

    broadcastToDashboard({
      event: 'call_ended',
      callSid: sessionId,
      timestamp: new Date().toISOString(),
    });

    clearSessionState(sessionId);

    if (deepgramWs.readyState === WebSocket.OPEN || deepgramWs.readyState === WebSocket.CONNECTING) {
      deepgramWs.close();
    }
  });

  ws.on('error', (err) => {
    Logger.error(`Session WebSocket error — sessionId: ${sessionId}`, err, 'SESSION');
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
  });
};
