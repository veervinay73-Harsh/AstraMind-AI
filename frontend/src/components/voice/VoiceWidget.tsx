'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  Volume2,
  Video,
  MicOff,
  Mic,
  MessageSquare,
  Grid3X3,
  BrainCircuit,
  Zap
} from 'lucide-react';
import { useVoiceSession } from '../../hooks/useVoiceSession';

export function VoiceWidget() {
  const { status, transcripts, error, startSession, stopSession, isActive, isMuted, toggleMute } = useVoiceSession();
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript panel
  useEffect(() => {
    if (showTranscript) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts, showTranscript]);

  const handleMainAction = () => {
    if (isActive) {
      stopSession();
      setShowTranscript(false);
    } else {
      startSession();
    }
  };



  const isConnected = status === 'listening' || status === 'speaking' || status === 'thinking';
  const isConnecting = status === 'connecting';

  return (
    <div className="relative w-full max-w-[360px] mx-auto aspect-[9/19.5] max-h-[850px] min-h-[650px] bg-[#000000] rounded-[3rem] overflow-hidden border-[10px] border-[#181818] shadow-2xl flex flex-col font-sans text-white">
      
      {/* ── Dynamic Island / Top Bar Placeholder ── */}
      <div className="absolute top-0 left-0 right-0 h-10 flex items-center justify-between px-6 pointer-events-none z-10 text-[13px] font-semibold">
        <span className="w-12 text-center">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
        <div className="w-[120px] h-7 bg-black rounded-full mt-2" />
        <span className="w-12 flex justify-end gap-1 items-center">
          <div className="w-4 h-3 border border-white/40 rounded-sm relative"><div className="absolute inset-[1px] bg-white rounded-[1px] w-[80%]" /></div>
        </span>
      </div>

      {/* ── Avatar & Status ── */}
      <div className="flex flex-col items-center pt-24 px-6 flex-1 z-10 relative">
        {/* Avatar */}
        <div className="relative w-[110px] h-[110px] rounded-full bg-[#111115] flex items-center justify-center mb-5 shadow-[0_0_40px_rgba(59,130,246,0.1)] border border-[#2a2a30]">
          <BrainCircuit className="w-14 h-14 text-blue-500" />
          {/* Subtle glow if active */}
          {(isConnecting || isConnected) && (
            <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-xl animate-pulse pointer-events-none" />
          )}
        </div>

        {/* Status Text (if active) */}
        {(isConnecting || isConnected) && (
          <p className="text-zinc-400 text-[15px] mb-1 font-medium tracking-wide animate-pulse">
            {isConnecting ? 'Calling...' : status === 'thinking' ? 'Processing...' : status === 'speaking' ? 'Speaking...' : '00:00'}
          </p>
        )}

        {/* Title */}
        <h1 className="text-3xl font-semibold tracking-tight text-white mb-1.5 text-center px-2">
          Customer Support
        </h1>

        {/* Subtitle */}
        <p className="text-zinc-400 text-[16px] text-center mb-8">
          Delivery Assistant
        </p>

        {/* Call-to-action text (only if idle) */}
        {!isActive && (
          <p className="text-zinc-400 text-[14px] text-center max-w-[260px] leading-[1.4] opacity-80">
            Click the call button to connect to the automated AI delivery support line.
          </p>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mt-4 px-4 py-2.5 bg-red-900/30 border border-red-500/30 rounded-xl max-w-[90%]">
            <p className="text-red-400 text-[13px] text-center leading-snug">{error}</p>
          </div>
        )}
      </div>

      {/* ── Transcript Overlay ── */}
      {showTranscript && isActive && (
        <div className="absolute inset-x-4 top-1/4 bottom-[300px] bg-zinc-900/90 backdrop-blur-md rounded-[1.5rem] border border-white/10 p-5 overflow-y-auto flex flex-col gap-3.5 z-20 shadow-2xl">
          <div className="sticky top-0 bg-zinc-900/90 pb-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-widest flex items-center justify-between border-b border-white/10 mb-2">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-blue-400" />
              Live Transcript
            </div>
            <span>{transcripts.length} msgs</span>
          </div>
          {transcripts.map((entry) => {
            const isAi = entry.speaker === 'ai';
            return (
              <div
                key={entry.id}
                className={`flex flex-col max-w-[85%] ${isAi ? 'mr-auto items-start' : 'ml-auto items-end'}`}
              >
                <div
                  className={`px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm ${
                    isAi
                      ? 'bg-[#2c2c2e] text-white rounded-tl-sm'
                      : 'bg-blue-600 text-white rounded-tr-sm'
                  } ${!entry.isFinal ? 'opacity-60 italic' : ''}`}
                >
                  {entry.text}
                </div>
              </div>
            );
          })}
          <div ref={transcriptEndRef} />
        </div>
      )}

      {/* ── Bottom Controls ── */}
      <div className="w-full pb-[4.5rem] px-6 flex flex-col items-center mt-auto z-10 relative">
        
        {isActive ? (
          /* Active Call Controls Grid */
          <div className="w-full max-w-[290px] mx-auto">
            <div className="grid grid-cols-3 gap-y-[26px] gap-x-5 mb-14">
              
              <div className="flex flex-col items-center gap-2 cursor-pointer">
                <div className="w-[72px] h-[72px] rounded-full bg-[#333333] flex items-center justify-center transition-colors hover:bg-[#444444]">
                  <Volume2 className="w-[28px] h-[28px] text-white fill-white" />
                </div>
                <span className="text-[13px] text-zinc-100 tracking-wide">speaker</span>
              </div>
              
              <div className="flex flex-col items-center gap-2 cursor-not-allowed opacity-40">
                <div className="w-[72px] h-[72px] rounded-full bg-[#333333] flex items-center justify-center">
                  <Video className="w-8 h-8 text-white fill-transparent" />
                </div>
                <span className="text-[13px] text-zinc-100 tracking-wide">FaceTime</span>
              </div>
              
              <div 
                className="flex flex-col items-center gap-2 cursor-pointer"
                onClick={toggleMute}
              >
                <div className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-white text-black' : 'bg-[#333333] text-white hover:bg-[#444444]'}`}>
                  {isMuted ? <MicOff className="w-[28px] h-[28px]" /> : <Mic className="w-[28px] h-[28px]" />}
                </div>
                <span className="text-[13px] text-zinc-100 tracking-wide">mute</span>
              </div>
              
              <div 
                className="flex flex-col items-center gap-2 cursor-pointer"
                onClick={() => setShowTranscript(!showTranscript)}
              >
                <div className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-colors ${showTranscript ? 'bg-white text-black' : 'bg-[#333333] text-white hover:bg-[#444444]'}`}>
                  <MessageSquare className="w-7 h-7" />
                </div>
                <span className="text-[13px] text-zinc-100 tracking-wide">transcript</span>
              </div>
              
              {/* Red End Button */}
              <div className="flex flex-col items-center gap-2 cursor-pointer col-start-2 row-start-2" onClick={handleMainAction}>
                <div className="w-[72px] h-[72px] rounded-full bg-[#ff3b30] flex items-center justify-center hover:bg-[#ff453a] transition-transform active:scale-95 shadow-[0_0_20px_rgba(255,59,48,0.2)]">
                  <PhoneOff className="w-8 h-8 text-white fill-white" />
                </div>
                <span className="text-[13px] text-zinc-100 tracking-wide">End</span>
              </div>

              <div className="flex flex-col items-center gap-2 cursor-not-allowed opacity-40 col-start-3 row-start-2">
                <div className="w-[72px] h-[72px] rounded-full bg-[#333333] flex items-center justify-center">
                  <Grid3X3 className="w-7 h-7 text-white" />
                </div>
                <span className="text-[13px] text-zinc-100 tracking-wide">keypad</span>
              </div>

            </div>
          </div>
        ) : (
          /* Idle State Call Button */
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleMainAction}
              className="w-[76px] h-[76px] rounded-full bg-[#34c759] hover:bg-[#30d158] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(52,199,89,0.3)]"
            >
              <Phone className="w-9 h-9 text-white fill-white" />
            </button>
            <span className="text-[14px] font-medium text-zinc-100 mt-1">Call Support</span>
          </div>
        )}
      </div>

    </div>
  );
}
