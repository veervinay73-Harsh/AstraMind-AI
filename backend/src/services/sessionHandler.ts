import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Logger } from '../utils/logger';
import { orchestrateTurn } from './orchestrator';
import { generateVoiceResponse } from './responseGenerator';
import { getSessionState, clearSessionState } from './stateManager';
import prisma from '../config/prisma';
import { broadcastToDashboard } from './eventHub';
import { synthesizeSpeech } from './elevenLabsService';

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

  prisma.hospital.findFirst()
    .then((hospital) => {
      if (hospital) {
        hospitalId = hospital.id;
        Logger.info(`Session resolved hospital: ${hospital.name} (${hospital.id})`, 'SESSION');
      }
    })
    .catch((err) => Logger.error('Failed to resolve hospital ID', err, 'SESSION'));

  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramApiKey) {
    Logger.error('DEEPGRAM_API_KEY not configured — cannot start session.', null, 'SESSION');
    send({ type: 'error', message: 'Speech-to-text service not available. Please configure DEEPGRAM_API_KEY.' });
    ws.close();
    return;
  }

  const keywordParams = ['AstraMind:3', 'appointment:2', 'cancellation:2', 'reschedule:2', 'cardiologist:2', 'dermatologist:2', 'orthopedics:2', 'neurologist:2', 'pediatrician:2']
    .map(k => `&keywords=${encodeURIComponent(k)}`)
    .join('');
  const deepgramUrl = `wss://api.deepgram.com/v1/listen?model=nova-2-conversationalai&language=en&smart_format=true&punctuate=true&paragraphs=false&filler_words=false&endpointing=500&interim_results=false${keywordParams}`;

  let deepgramWs: WebSocket | null = null;
  let deepgramReady = false;
  let hasGreeted = false;
  const audioQueue: Buffer[] = [];
  let keepAliveInterval: NodeJS.Timeout | null = null;

  const connectDeepgram = () => {
    Logger.info('Connecting to Deepgram...', 'DEEPGRAM');
    deepgramWs = new WebSocket(deepgramUrl, {
      headers: { Authorization: `Token ${deepgramApiKey}` },
    });

    deepgramWs.on('open', () => {
      deepgramReady = true;
      Logger.info('Deepgram STT connected for browser session.', 'DEEPGRAM');

      keepAliveInterval = setInterval(() => {
        if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
          Logger.info('Sending KeepAlive to Deepgram', 'DEEPGRAM');
          deepgramWs.send(JSON.stringify({ type: 'KeepAlive' }));
        }
      }, 5000);

      while (audioQueue.length > 0) {
        const chunk = audioQueue.shift();
        if (chunk && deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
          deepgramWs.send(chunk);
          audioChunkCount++;
        }
      }

      if (!hasGreeted) {
        hasGreeted = true;
        broadcastToDashboard({
          event: 'call_started',
          callSid: sessionId,
          callerPhone: participantName,
          hospitalPhone: '',
          timestamp: new Date().toISOString(),
        });

        const greetingText = "Hello! Welcome to AstraMind Integrated Medical Center. I'm your AI receptionist. How may I assist you today?";
        
        send({ type: 'ai_response', text: greetingText });
        broadcastToDashboard({
          event: 'ai_response_generated',
          callSid: sessionId,
          response: greetingText,
          speaker: 'ai',
          timestamp: new Date().toISOString(),
        });

        send({ type: 'status', status: 'speaking' });
        broadcastToDashboard({ event: 'ai_status_change', callSid: sessionId, status: 'speaking' });

        synthesizeSpeech(greetingText)
          .then((audioBuffer) => {
            if (audioBuffer && ws.readyState === WebSocket.OPEN) {
              Logger.info(`Sending ${audioBuffer.length} bytes of greeting MP3 audio over WebSocket to client`, 'SESSION');
              ws.send(audioBuffer);
              send({ type: 'audio_end' });
            } else {
              Logger.warn(`ElevenLabs synthesis failed for greeting. Emitting 'tts_failed' event for client fallback.`, 'SESSION');
              send({ type: 'tts_failed', text: greetingText });
            }
          })
          .catch((err) => {
            Logger.error('Failed to play auto-greeting', err, 'SESSION');
          });
      }
    });

    deepgramWs.on('message', (rawMsg: Buffer | string) => {
      try {
        const response = JSON.parse(rawMsg.toString());
        const transcript: string = response.channel?.alternatives?.[0]?.transcript || '';
        const confidence: number = response.channel?.alternatives?.[0]?.confidence || 1.0;
        const isFinal: boolean = response.is_final === true;

        if (!transcript.trim()) return;

        Logger.info(`Deepgram STT -> Transcript: "${transcript}" | Confidence: ${confidence.toFixed(2)} | isFinal: ${isFinal}`, 'DEEPGRAM');

        send({ type: 'transcript', text: transcript, isFinal, speaker: 'patient' });

        broadcastToDashboard({
          event: 'transcript_received',
          callSid: sessionId,
          transcript,
          isFinal,
          speaker: 'patient',
          timestamp: new Date().toISOString(),
        });

        if (isFinal && !isProcessing) {
          if (confidence < 0.6) {
            Logger.warn(`Low transcription confidence (${confidence.toFixed(2)}). Asking patient to repeat.`, 'DEEPGRAM');
            isProcessing = true;
            send({ type: 'status', status: 'thinking' });
            broadcastToDashboard({ event: 'ai_status_change', callSid: sessionId, status: 'thinking' });

            const repeatMsg = "I'm sorry, I didn't quite catch that. Could you please repeat it?";
            send({ type: 'ai_response', text: repeatMsg });
            broadcastToDashboard({
              event: 'ai_response_generated',
              callSid: sessionId,
              response: repeatMsg,
              speaker: 'ai',
              timestamp: new Date().toISOString(),
            });

            send({ type: 'status', status: 'speaking' });
            broadcastToDashboard({ event: 'ai_status_change', callSid: sessionId, status: 'speaking' });

            synthesizeSpeech(repeatMsg)
              .then((audioBuffer) => {
                if (audioBuffer && ws.readyState === WebSocket.OPEN) {
                  ws.send(audioBuffer);
                  send({ type: 'audio_end' });
                } else {
                  send({ type: 'tts_failed', text: repeatMsg });
                }
                isProcessing = false;
              })
              .catch((err) => {
                Logger.error('Speech synthesis failed in low-confidence fallback', err, 'SESSION');
                send({ type: 'tts_failed', text: repeatMsg });
                isProcessing = false;
              });
            return;
          }

          isProcessing = true;
          Logger.info(`Patient [${sessionId}]: "${transcript}"`, 'SESSION');

          send({ type: 'status', status: 'thinking' });
          broadcastToDashboard({ event: 'ai_status_change', callSid: sessionId, status: 'thinking' });

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

              const voiceResponse = await generateVoiceResponse(transcript, sessionState, orchestratorResult, sessionId);
              Logger.info(`AI [${sessionId}]: "${voiceResponse}"`, 'SESSION');

              const isBookingSuccess = orchestratorResult.selected_tool === 'BOOK_APPOINTMENT' &&
                (orchestratorResult.result && (orchestratorResult.result.status === 'BOOKED' || orchestratorResult.result.status === 'SUCCESS' || orchestratorResult.result.appointmentId));

              send({ type: 'ai_response', text: voiceResponse, disconnectAfterPlay: isBookingSuccess });
              broadcastToDashboard({
                event: 'ai_response_generated',
                callSid: sessionId,
                response: voiceResponse,
                speaker: 'ai',
                timestamp: new Date().toISOString(),
              });

              send({ type: 'status', status: 'speaking' });
              broadcastToDashboard({ event: 'ai_status_change', callSid: sessionId, status: 'speaking' });

              const audioBuffer = await synthesizeSpeech(voiceResponse);
              if (audioBuffer && ws.readyState === WebSocket.OPEN) {
                Logger.info(`Sending ${audioBuffer.length} bytes of synthesized MP3 audio over WebSocket to client`, 'SESSION');
                ws.send(audioBuffer);
                send({ type: 'audio_end', disconnectAfterPlay: isBookingSuccess });
              } else {
                Logger.warn(`ElevenLabs synthesis failed or returned empty. Emitting 'tts_failed' fallback event for client.`, 'SESSION');
                send({ type: 'tts_failed', text: voiceResponse, disconnectAfterPlay: isBookingSuccess });
              }
            })
            .catch((err) => {
              Logger.error('AI pipeline error in session handler', err, 'SESSION');
              send({ type: 'error', message: 'AI processing failed. Please try again.' });
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
    deepgramWs.on('close', (code, reason) => {
      deepgramReady = false;
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      Logger.info(`Deepgram STT connection closed (${code}: ${reason.toString()}).`, 'DEEPGRAM');
      
      // Auto-reconnect if client is still connected
      if (ws.readyState === WebSocket.OPEN) {
        Logger.warn('Deepgram closed unexpectedly. Reconnecting...', 'DEEPGRAM');
        setTimeout(connectDeepgram, 1000);
      }
    });
  };

  // Initial connection
  connectDeepgram();

  ws.on('message', (data: Buffer, isBinary: boolean) => {
    if (!isBinary) {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'stop') {
          Logger.info(`Session stop requested by client: ${sessionId}`, 'SESSION');
        }
      } catch { /* ignore */ }
      return;
    }

    if (!deepgramReady || !deepgramWs || deepgramWs.readyState !== WebSocket.OPEN) {
      audioQueue.push(data);
    } else {
      deepgramWs.send(data);
      audioChunkCount++;
    }
  });

  ws.on('close', () => {
    Logger.info(`Browser session disconnected — sessionId: ${sessionId} — chunks: ${audioChunkCount}`, 'SESSION');
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }

    broadcastToDashboard({
      event: 'call_ended',
      callSid: sessionId,
      timestamp: new Date().toISOString(),
    });

    clearSessionState(sessionId);

    if (deepgramWs && (deepgramWs.readyState === WebSocket.OPEN || deepgramWs.readyState === WebSocket.CONNECTING)) {
      deepgramWs.close();
    }
  });

  ws.on('error', (err) => {
    Logger.error(`Session WebSocket error — sessionId: ${sessionId}`, err, 'SESSION');
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
  });
};
