import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Logger } from '../utils/logger';
import { orchestrateTurn } from './orchestrator';
import { generateVoiceResponse } from './responseGenerator';
import { getSessionState, clearSessionState } from './stateManager';
import prisma from '../config/prisma';
import { broadcastToDashboard } from './eventHub';

export const handleVoiceStream = (ws: WebSocket, req?: IncomingMessage): void => {
  Logger.info('Twilio voice stream WebSocket connected.', 'VOICE_STREAM');

  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramApiKey) {
    Logger.error('DEEPGRAM_API_KEY is not defined in environment variables.', null, 'VOICE_STREAM');
    ws.close();
    return;
  }

  // 1. Parse connection information from request query parameters
  const urlObj = new URL(req?.url || '', `http://${req?.headers.host || 'localhost'}`);
  const callerPhone = urlObj.searchParams.get('callerPhone') || '+15557778888';
  const hospitalPhone = urlObj.searchParams.get('hospitalPhone') || '';
  
  let callSid = 'UNKNOWN';
  let hospitalId = 'default-hospital-id';

  // Resolve hospitalId asynchronously
  prisma.hospital.findFirst({
    where: hospitalPhone ? { phone: hospitalPhone } : undefined,
  }).then(async (hospital) => {
    if (hospital) {
      hospitalId = hospital.id;
    } else {
      const firstHospital = await prisma.hospital.findFirst();
      if (firstHospital) {
        hospitalId = firstHospital.id;
      }
    }
    Logger.info(`Resolved hospital ID: ${hospitalId} for phone: ${hospitalPhone}`, 'VOICE_STREAM');
  }).catch((err) => {
    Logger.error('Failed to resolve hospital ID for voice stream', err, 'VOICE_STREAM');
  });

  // 2. Connect to Deepgram Streaming API
  const deepgramUrl = 'wss://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000&channels=1&model=nova-2&punctuate=true&interim_results=true';
  const deepgramWs = new WebSocket(deepgramUrl, {
    headers: {
      Authorization: `Token ${deepgramApiKey}`,
    },
  });

  let streamSid: string | null = null;
  let mediaChunkCount = 0;
  let isDeepgramReady = false;

  deepgramWs.on('open', () => {
    isDeepgramReady = true;
    Logger.info('Deepgram transcription WebSocket stream established.', 'DEEPGRAM');
  });

  deepgramWs.on('message', (message: string) => {
    try {
      const response = JSON.parse(message);
      const transcript = response.channel?.alternatives?.[0]?.transcript;
      const isFinal = response.is_final;

      if (transcript) {
        // Broadcast transcription event to the dashboard (interim or final)
        broadcastToDashboard({
          event: 'transcript_received',
          callSid,
          transcript,
          isFinal,
          speaker: 'patient',
          timestamp: new Date().toISOString(),
        });

        if (isFinal) {
          Logger.info(`Patient Transcript (FINAL): "${transcript}"`, 'DEEPGRAM');
          
          // Set AI status to thinking
          broadcastToDashboard({
            event: 'ai_status_change',
            callSid,
            status: 'thinking',
          });

          // Run the full AI Orchestrator + Dialogue synthesis pipeline
          orchestrateTurn(callSid, transcript, hospitalId, callerPhone)
            .then(async (orchestratorResult) => {
              Logger.info(`Orchestrator Decision: ${orchestratorResult.selected_tool} - Reason: ${orchestratorResult.reason}`, 'ORCHESTRATOR');
              Logger.info(`Tool Outcome: ${JSON.stringify(orchestratorResult.result, null, 2)}`, 'ORCHESTRATOR');

              const sessionState = getSessionState(callSid);

              // Broadcast tool execution and state update details to dashboard
              broadcastToDashboard({
                event: 'tool_executed',
                callSid,
                tool: orchestratorResult.selected_tool,
                reason: orchestratorResult.reason,
                result: orchestratorResult.result,
                state: sessionState,
              });

              // Set AI status to speaking
              broadcastToDashboard({
                event: 'ai_status_change',
                callSid,
                status: 'speaking',
              });

              const voiceResponse = await generateVoiceResponse(transcript, sessionState, orchestratorResult);
              Logger.info(`👉 Generated Speakable Response: "${voiceResponse}"`, 'RESPONSE_GENERATOR');

              // Broadcast response to dashboard
              broadcastToDashboard({
                event: 'ai_response_generated',
                callSid,
                response: voiceResponse,
                speaker: 'ai',
                timestamp: new Date().toISOString(),
              });

              // Set AI status back to listening
              broadcastToDashboard({
                event: 'ai_status_change',
                callSid,
                status: 'listening',
              });
            })
            .catch((err) => {
              Logger.error('Failed to orchestrate turn in voice stream pipeline', err, 'VOICE_STREAM');
              broadcastToDashboard({
                event: 'ai_status_change',
                callSid,
                status: 'listening',
              });
            });
        }
      }
    } catch (error) {
      Logger.error('Error parsing Deepgram transcription message', error, 'DEEPGRAM');
    }
  });

  deepgramWs.on('error', (err) => {
    Logger.error('Deepgram WebSocket connection error', err, 'DEEPGRAM');
  });

  deepgramWs.on('close', () => {
    Logger.info('Deepgram transcription WebSocket stream closed.', 'DEEPGRAM');
  });

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);

      switch (data.event) {
        case 'start':
          streamSid = data.start.streamSid;
          callSid = data.start.callSid || 'UNKNOWN';
          Logger.info(
            `Voice stream started - StreamSid: ${streamSid} - CallSid: ${callSid}`,
            'VOICE_STREAM'
          );

          // Broadcast call start to dashboard
          broadcastToDashboard({
            event: 'call_started',
            callSid,
            callerPhone,
            hospitalPhone,
            timestamp: new Date().toISOString(),
          });

          // Set initial AI status to listening
          broadcastToDashboard({
            event: 'ai_status_change',
            callSid,
            status: 'listening',
          });
          break;

        case 'media':
          mediaChunkCount++;
          
          if (isDeepgramReady && deepgramWs.readyState === WebSocket.OPEN) {
            const audioBuffer = Buffer.from(data.media.payload, 'base64');
            deepgramWs.send(audioBuffer);
          }

          if (mediaChunkCount % 100 === 0) {
            Logger.info(
              `Received ${mediaChunkCount} audio chunks from Twilio stream: ${streamSid}`,
              'VOICE_STREAM'
            );
          }
          break;

        case 'stop':
          Logger.info(`Voice stream stopped - StreamSid: ${streamSid}`, 'VOICE_STREAM');
          if (deepgramWs.readyState === WebSocket.OPEN) {
            deepgramWs.send(JSON.stringify({ type: 'CloseStream' }));
            deepgramWs.close();
          }
          break;

        default:
          break;
      }
    } catch (error) {
      Logger.error('Error parsing WebSocket message from Twilio', error, 'VOICE_STREAM');
    }
  });

  ws.on('close', () => {
    Logger.info(`Twilio voice stream WebSocket disconnected. Total chunks: ${mediaChunkCount}`, 'VOICE_STREAM');
    
    // Broadcast call end to dashboard
    broadcastToDashboard({
      event: 'call_ended',
      callSid,
      timestamp: new Date().toISOString(),
    });

    if (callSid && callSid !== 'UNKNOWN') {
      clearSessionState(callSid);
      Logger.info(`Cleared session state for CallSid: ${callSid}`, 'VOICE_STREAM');
    }
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
  });

  ws.on('error', (err) => {
    Logger.error('WebSocket connection error on Voice Stream', err, 'VOICE_STREAM');
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
  });
};
