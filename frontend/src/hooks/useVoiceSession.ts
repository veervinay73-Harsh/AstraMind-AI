'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type VoiceStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'
  | 'disconnected';

export interface TranscriptEntry {
  id: string;
  text: string;
  speaker: 'patient' | 'ai';
  isFinal: boolean;
  timestamp: string;
}

// ── URL helpers ────────────────────────────────────────────────────────────────

const getWsBase = (): string => {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  // "http://localhost:5000/api" → "ws://localhost:5000"
  return apiBase.replace(/^https?/, 'ws').replace(/\/api$/, '');
};

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useVoiceSession() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const expectingAudioRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const disconnectOnEndRef = useRef<boolean>(false);

  // ── Microphone control helpers ──────────────────────────────────────────────

  const setMicrophoneMute = useCallback((muted: boolean) => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      console.log(`[useVoiceSession] Microphone track ${muted ? 'MUTED' : 'UNMUTED'}.`);
    }
  }, []);

  // ── Cleanup helper ───────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    expectingAudioRef.current = false;
    disconnectOnEndRef.current = false;
  }, []);

  // ── Stop session ─────────────────────────────────────────────────────────────

  const stopSession = useCallback(() => {
    cleanup();
    setStatus('disconnected');
    setSessionId(null);
  }, [cleanup]);

  // ── Audio playback ───────────────────────────────────────────────────────────

  const playAudioBuffer = useCallback(async (data: ArrayBuffer) => {
    try {
      console.log('[useVoiceSession] Starting audio context preparation...');
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioContext();
        gainRef.current = audioCtxRef.current.createGain();
        gainRef.current.connect(audioCtxRef.current.destination);
      }
      if (audioCtxRef.current.state === 'suspended') {
        console.log('[useVoiceSession] Resuming suspended audio context...');
        await audioCtxRef.current.resume();
      }

      console.log(`[useVoiceSession] Decoding ${data.byteLength} bytes of audio data...`);
      const decoded = await audioCtxRef.current.decodeAudioData(data.slice(0));
      console.log('[useVoiceSession] Audio decoded successfully. Muting microphone and starting playback...');
      
      setMicrophoneMute(true);
      isSpeakingRef.current = true;
      setStatus('speaking');

      const src = audioCtxRef.current.createBufferSource();
      src.buffer = decoded;
      src.connect(gainRef.current!);
      src.start();
      console.log('[useVoiceSession] Audio playback started.');

      src.onended = () => {
        console.log('[useVoiceSession] Audio playback finished.');
        if (disconnectOnEndRef.current) {
          console.log('[useVoiceSession] Closing voice session after greeting/goodbye.');
          stopSession();
        } else {
          console.log('[useVoiceSession] Unmuting microphone.');
          isSpeakingRef.current = false;
          setMicrophoneMute(false);
          setStatus('listening');
        }
      };
    } catch (err) {
      console.warn('[useVoiceSession] Audio playback error:', err);
      if (disconnectOnEndRef.current) {
        stopSession();
      } else {
        isSpeakingRef.current = false;
        setMicrophoneMute(false);
        setStatus('listening');
      }
    }
  }, [setMicrophoneMute, stopSession]);



  // ── Start session ────────────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    try {
      setError(null);
      setStatus('connecting');
      setTranscripts([]);

      // 1. Request microphone access
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (micErr) {
        const msg = micErr instanceof Error ? micErr.message : 'Unknown error';
        throw new Error(
          msg.includes('NotAllowed') || msg.includes('Permission')
            ? 'Microphone access denied. Please allow microphone permission and try again.'
            : `Microphone error: ${msg}`
        );
      }

      streamRef.current = stream;

      const sid = `session-${Date.now()}`;
      setSessionId(sid);

      // 2. Connect to backend voice session WebSocket
      const wsUrl = `${getWsBase()}/api/session?sessionId=${sid}&participantName=Patient`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        // 3. Start MediaRecorder once WebSocket is open
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        const mr = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mr;

        mr.addEventListener('dataavailable', (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data); // Send binary audio chunk to backend
          }
        });

        mr.start(250); // 250ms chunks
      };

      ws.onmessage = (event) => {
        // Binary message = audio data from ElevenLabs
        if (event.data instanceof ArrayBuffer) {
          console.log(`[useVoiceSession] Received binary audio frame of size: ${event.data.byteLength} bytes.`);
          playAudioBuffer(event.data);
          return;
        }

        try {
          const msg = JSON.parse(event.data as string);

          switch (msg.type) {
            case 'status':
              const newStatus = msg.status as VoiceStatus;
              setStatus(newStatus);
              if (newStatus === 'thinking' || newStatus === 'speaking') {
                setMicrophoneMute(true);
              } else if (newStatus === 'listening' && !isSpeakingRef.current) {
                setMicrophoneMute(false);
              }
              break;

            case 'transcript':
              setTranscripts((prev) => {
                // Replace last interim entry from same speaker if this is also interim
                if (msg.speaker === 'patient' && !msg.isFinal) {
                  const lastIdx = [...prev].reverse().findIndex(
                    (t) => t.speaker === 'patient' && !t.isFinal
                  );
                  if (lastIdx !== -1) {
                    const idx = prev.length - 1 - lastIdx;
                    const next = [...prev];
                    next[idx] = { ...next[idx], text: msg.text };
                    return next;
                  }
                }
                return [
                  ...prev,
                  {
                    id: `${Date.now()}-${Math.random()}`,
                    text: msg.text as string,
                    speaker: msg.speaker as 'patient' | 'ai',
                    isFinal: msg.isFinal as boolean,
                    timestamp: new Date().toISOString(),
                  },
                ];
              });
              break;

            case 'ai_response':
              if (msg.disconnectAfterPlay) {
                disconnectOnEndRef.current = true;
              }
              setTranscripts((prev) => [
                ...prev,
                {
                  id: `ai-${Date.now()}`,
                  text: msg.text as string,
                  speaker: 'ai',
                  isFinal: true,
                  timestamp: new Date().toISOString(),
                },
              ]);
              break;

            case 'tts_failed':
              console.warn('[useVoiceSession] ElevenLabs TTS failed on backend. Falling back to browser-native SpeechSynthesis.');
              if (msg.disconnectAfterPlay) {
                disconnectOnEndRef.current = true;
              }
              if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                // Cancel any ongoing speech first
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(msg.text);
                const voices = window.speechSynthesis.getVoices();
                // Select a natural sounding English voice if available
                const englishVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
                if (englishVoice) {
                  utterance.voice = englishVoice;
                }

                utterance.onstart = () => {
                  console.log('[useVoiceSession] Browser-native SpeechSynthesis started. Muting microphone.');
                  setMicrophoneMute(true);
                  isSpeakingRef.current = true;
                  setStatus('speaking');
                };

                utterance.onend = () => {
                  console.log('[useVoiceSession] Browser-native SpeechSynthesis finished.');
                  if (disconnectOnEndRef.current) {
                    console.log('[useVoiceSession] Closing voice session after SpeechSynthesis goodbye.');
                    stopSession();
                  } else {
                    console.log('[useVoiceSession] Unmuting microphone.');
                    isSpeakingRef.current = false;
                    setMicrophoneMute(false);
                    setStatus('listening');
                  }
                };

                utterance.onerror = (e) => {
                  console.warn('[useVoiceSession] SpeechSynthesis error:', e);
                  if (disconnectOnEndRef.current) {
                    stopSession();
                  } else {
                    isSpeakingRef.current = false;
                    setMicrophoneMute(false);
                    setStatus('listening');
                  }
                };

                window.speechSynthesis.speak(utterance);
                console.log('[useVoiceSession] Browser-native SpeechSynthesis playback initiated.');
              } else {
                console.error('[useVoiceSession] SpeechSynthesis API not supported in this browser.');
              }
              break;

            case 'audio_end':
              // Audio playback is complete, already handled in binary message path
              break;

            case 'error':
              setError(msg.message as string);
              break;
          }
        } catch { /* JSON parse error for binary-that-looked-like-text — safe to ignore */ }
      };

      ws.onclose = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
        setStatus((prev) => (prev === 'connecting' || prev === 'listening' || prev === 'thinking' || prev === 'speaking' ? 'disconnected' : prev));
      };

      ws.onerror = () => {
        setError('Connection to AI voice service failed. Check that the backend is running.');
        setStatus('error');
        cleanup();
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start voice session.';
      setError(message);
      setStatus('error');
      cleanup();
    }
  }, [cleanup, playAudioBuffer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    status,
    transcripts,
    error,
    sessionId,
    startSession,
    stopSession,
    isActive: status !== 'idle' && status !== 'disconnected' && status !== 'error',
  };
}
