'use client';

import { useRef, useEffect } from 'react';
import {
  Mic, MicOff, PhoneOff, Brain, Volume2, Wifi, WifiOff, AlertCircle, Zap,
} from 'lucide-react';
import { useVoiceSession } from '../../hooks/useVoiceSession';
import { AudioVisualizer } from './AudioVisualizer';
import { ConnectionStatus } from './ConnectionStatus';

// ── Call-to-action button label ────────────────────────────────────────────────

function getButtonLabel(status: ReturnType<typeof useVoiceSession>['status']): string {
  switch (status) {
    case 'idle': return 'Start AI Conversation';
    case 'connecting': return 'Connecting…';
    case 'listening': return 'Listening — speak now';
    case 'thinking': return 'AI is thinking…';
    case 'speaking': return 'AI is speaking…';
    case 'error': return 'Retry Conversation';
    case 'disconnected': return 'Reconnect';
  }
}

// ── VoiceWidget ────────────────────────────────────────────────────────────────

export function VoiceWidget() {
  const { status, transcripts, error, sessionId, startSession, stopSession, isActive } =
    useVoiceSession();

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript panel
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const handleMainAction = () => {
    if (isActive) {
      stopSession();
    } else {
      startSession();
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden shadow-sm">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-900">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
            isActive
              ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30'
              : 'bg-zinc-100 dark:bg-zinc-900'
          }`}>
            {status === 'thinking'
              ? <Brain className={`h-4 w-4 ${isActive ? 'text-white animate-spin' : 'text-zinc-500'}`} />
              : status === 'speaking'
              ? <Volume2 className={`h-4 w-4 ${isActive ? 'text-white animate-bounce' : 'text-zinc-500'}`} />
              : <Mic className={`h-4 w-4 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
            }
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">
              AI Voice Conversation
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Powered by LiveKit · Deepgram · Groq · ElevenLabs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status badge */}
          <ConnectionStatus status={status} />

          {/* Session ID pill */}
          {sessionId && (
            <span className="hidden sm:flex items-center gap-1 text-[9px] font-mono text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 px-2 py-0.5 rounded-full">
              <Wifi className="h-2.5 w-2.5" />
              {sessionId.slice(-8)}
            </span>
          )}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="p-5 space-y-5">

        {/* Error Banner */}
        {error && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700 dark:text-rose-400">{error}</p>
          </div>
        )}

        {/* Visualizer + CTA */}
        <div className="flex flex-col items-center gap-4 py-4">
          {/* Audio visualizer */}
          <AudioVisualizer status={status} barCount={9} />

          {/* AI Status label */}
          <p className="text-xs font-medium text-zinc-500 h-4 transition-all">
            {status === 'listening' && '🎤 Speak — I\'m listening'}
            {status === 'thinking' && '🤖 Processing your request…'}
            {status === 'speaking' && '🔊 AI is responding via ElevenLabs…'}
            {status === 'connecting' && '🔌 Establishing secure voice channel…'}
            {(status === 'idle' || status === 'disconnected') && 'Click to start a browser-based voice conversation'}
            {status === 'error' && 'Session ended due to an error'}
          </p>

          {/* Main Action Button */}
          <button
            onClick={handleMainAction}
            disabled={status === 'connecting'}
            className={`group relative flex items-center gap-2.5 h-12 px-7 rounded-2xl font-semibold text-sm transition-all duration-200 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${
              isActive
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.02]'
            }`}
          >
            {isActive ? (
              <>
                <PhoneOff className="h-4 w-4" />
                End Session
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                {getButtonLabel(status)}
              </>
            )}

            {/* Pulse ring when active */}
            {isActive && (
              <span className="absolute -inset-1 rounded-2xl border-2 border-rose-400/40 animate-ping pointer-events-none" />
            )}
          </button>

          {/* Mute hint when active */}
          {status === 'listening' && (
            <p className="text-[10px] text-zinc-400 flex items-center gap-1">
              <MicOff className="h-3 w-3" />
              Click End Session to stop the conversation
            </p>
          )}
        </div>

        {/* ── Transcript Panel ── */}
        {transcripts.length > 0 && (
          <div className="rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-900">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-indigo-400" />
                Live Transcript
              </span>
              <span className="text-[10px] text-zinc-400">{transcripts.length} exchanges</span>
            </div>

            <div className="p-4 max-h-56 overflow-y-auto space-y-3">
              {transcripts.map((entry) => {
                const isAi = entry.speaker === 'ai';
                return (
                  <div
                    key={entry.id}
                    className={`flex flex-col max-w-[85%] ${isAi ? 'mr-auto items-start' : 'ml-auto items-end'}`}
                  >
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1 px-1">
                      {isAi ? '🤖 AstraMind AI' : '🎤 You'}
                    </span>
                    <div
                      className={`px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                        isAi
                          ? 'bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-sm'
                          : 'bg-indigo-600 text-white rounded-tr-sm'
                      } ${!entry.isFinal ? 'opacity-60 italic' : ''}`}
                    >
                      {entry.text}
                    </div>
                    <span className="text-[9px] text-zinc-400 mt-1 px-1">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                );
              })}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}

        {/* ── Architecture badge ── */}
        <div className="flex items-center justify-center gap-1.5 text-[9px] text-zinc-300 dark:text-zinc-700 font-mono pt-1">
          <WifiOff className="h-2.5 w-2.5" />
          <span>No PSTN · No Phone Number · Browser-Native WebRTC</span>
        </div>
      </div>
    </div>
  );
}
