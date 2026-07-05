"use client";

import { useLiveCalls, CallSession, TranscriptItem } from "@/context/LiveCallsContext";
import { useEffect, useRef, useState } from "react";
import { VoiceWidget } from "@/components/voice/VoiceWidget";
import {
  Phone,
  Clock,
  Mic,
  Brain,
  Volume2,
  AlertTriangle,
  History,
  Info,
  CheckCircle,
  FileText,
  User,
  Calendar,
  Stethoscope,
  Activity,
  Wifi,
  WifiOff
} from "lucide-react";

export default function LiveCallsPage() {
  const { calls, isConnected, isConnecting, activeCallId, setActiveCallId } = useLiveCalls();
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const callList = Object.values(calls || {}).sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  const activeCall = activeCallId ? calls[activeCallId] : null;

  // Auto-scroll to the bottom of the transcript when new logs arrive
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeCall?.transcripts]);

  // Format Duration helper
  const getCallDuration = (call: CallSession) => {
    const start = new Date(call.startTime).getTime();
    const end = call.endTime ? new Date(call.endTime).getTime() : now;
    const diff = Math.max(0, end - start);
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  };

  // State for live duration clock ticks
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/* Title & Connection Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Real-Time Call Console</h1>
          <p className="text-sm text-zinc-500">Monitor active voice conversations, AI dialog intents, and slot filling parameters.</p>
        </div>

        {/* WebSocket Connection Status Indicator */}
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">
              <Wifi className="h-3.5 w-3.5" />
              <span>Live System Connected</span>
            </span>
          ) : isConnecting ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/20 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/10 animate-pulse">
              <Activity className="h-3.5 w-3.5 animate-spin" />
              <span>Reconnecting Stream...</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/20 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/10">
              <WifiOff className="h-3.5 w-3.5" />
              <span>Pipeline Disconnected</span>
            </span>
          )}
        </div>
      </div>

      {/* VoiceWidget — Browser-based AI voice conversation */}
      <VoiceWidget />

      {/* Main Panel Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* LEFT COLUMN: Calls List */}
        <div className="lg:col-span-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex flex-col h-[calc(100vh-14rem)] min-h-[450px]">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3 px-1">Call Sessions Feed</h2>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {callList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400">
                <Phone className="h-8 w-8 text-zinc-300 mb-2 animate-bounce" />
                <p className="text-xs font-medium">No active sessions yet</p>
                <p className="text-[10px] text-zinc-500 mt-1">Start a browser voice conversation above to see it appear here in real-time.</p>
              </div>
            ) : (
              callList.map((call) => {
                const isActive = activeCallId === call.callSid;
                return (
                  <button
                    key={call.callSid}
                    onClick={() => setActiveCallId(call.callSid)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-2 ${
                      isActive
                        ? "border-indigo-500 bg-indigo-50/10 dark:bg-indigo-950/20"
                        : "border-zinc-100 dark:border-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-white truncate">
                        {call.callerPhone}
                      </span>
                      {call.status === "active" ? (
                        <span className="flex h-2 w-2 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-400 font-medium">Ended</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-zinc-400" />
                        {getCallDuration(call)}
                      </span>
                      <span className="uppercase tracking-wider font-semibold text-[10px] text-indigo-600 dark:text-indigo-400">
                        {call.intent.replace("_", " ")}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Call Monitor */}
        <div className="lg:col-span-2 flex flex-col h-[calc(100vh-14rem)] min-h-[450px]">
          {activeCall ? (
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              
              {/* Call Top Header */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    activeCall.status === "active"
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 animate-pulse"
                      : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400"
                  }`}>
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <span>{activeCall.callerPhone}</span>
                      <span className="text-xs font-mono text-zinc-400 font-light">({activeCall.callSid.slice(0, 10)}...)</span>
                    </h2>
                    <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                      <span>Duration: {getCallDuration(activeCall)}</span>
                      <span>•</span>
                      <span className="uppercase font-semibold text-[10px] text-indigo-500 tracking-wider">
                        {activeCall.intent.replace("_", " ")}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Live AI Speech Badges */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mr-1">AI Status:</span>
                  {activeCall.aiStatus === "listening" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 animate-pulse">
                      <Mic className="h-3.5 w-3.5" />
                      <span>Listening</span>
                    </span>
                  )}
                  {activeCall.aiStatus === "thinking" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/10">
                      <Brain className="h-3.5 w-3.5 animate-spin" />
                      <span>Thinking</span>
                    </span>
                  )}
                  {activeCall.aiStatus === "speaking" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">
                      <Volume2 className="h-3.5 w-3.5 animate-bounce" />
                      <span>Speaking</span>
                    </span>
                  )}
                  {activeCall.aiStatus === "idle" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-50 dark:bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-zinc-500 border border-zinc-200 dark:border-zinc-800">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Idle</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Middle Viewports split: Transcript vs State parameter boxes */}
              <div className="flex-1 grid gap-4 md:grid-cols-5 min-h-0 overflow-hidden">
                
                {/* 1. SCROLLING TRANSCRIPT PANEL */}
                <div className="md:col-span-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex flex-col min-h-0">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 shrink-0">
                    <Mic className="h-4 w-4 text-indigo-500" />
                    <span>Dialogue Transcription Stream</span>
                  </h3>

                  <div className="flex-1 overflow-y-auto space-y-3.5 pr-2">
                    {activeCall.transcripts.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 p-6">
                        <Activity className="h-6 w-6 text-zinc-300 mb-1 animate-pulse" />
                        <span className="text-xs font-medium">Awaiting voice speech input...</span>
                      </div>
                    ) : (
                      activeCall.transcripts.map((t) => {
                        const isAi = t.speaker === "ai";
                        return (
                          <div
                            key={t.id}
                            className={`flex flex-col max-w-[85%] ${
                              isAi ? "mr-auto items-start" : "ml-auto items-end"
                            }`}
                          >
                            <span className="text-[10px] text-zinc-400 font-semibold mb-1 uppercase tracking-wide px-1">
                              {isAi ? "AI Assistant" : "Patient"}
                            </span>
                            <div
                              className={`p-3 rounded-2xl text-sm ${
                                isAi
                                  ? "bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-900 text-zinc-800 dark:text-zinc-200 rounded-tl-xs"
                                  : "bg-indigo-600 text-white rounded-tr-xs"
                              }`}
                            >
                              <p className={t.isFinal ? "" : "opacity-60 italic"}>{t.text}</p>
                            </div>
                            <span className="text-[9px] text-zinc-400 mt-1 px-1">
                              {new Date(t.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                              })}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={transcriptEndRef} />
                  </div>
                </div>

                {/* 2. CONVERSATION STATE MANAGER PANEL */}
                <div className="md:col-span-2 flex flex-col gap-4 min-h-0 overflow-y-auto">
                  
                  {/* Slots Tracker */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-indigo-500" />
                      <span>Slot Parameter States</span>
                    </h3>

                    <div className="space-y-2.5">
                      {[
                        { label: "Patient Name", value: activeCall.state?.patient_name, field: "patient_name", icon: User },
                        { label: "Doctor Specialization", value: activeCall.state?.doctor, field: "doctor", icon: Stethoscope },
                        { label: "Date Scheduled", value: activeCall.state?.date, field: "date", icon: Calendar },
                        { label: "Time Slot", value: activeCall.state?.time, field: "time", icon: Clock },
                      ].map((slot) => {
                        const Icon = slot.icon;
                        const isMissing = activeCall.state?.missing_fields?.includes(slot.field);
                        const hasVal = !!slot.value;

                        return (
                          <div
                            key={slot.label}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                              hasVal
                                ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-400"
                                : isMissing
                                ? "bg-rose-50/30 dark:bg-rose-950/10 border-rose-500/20 text-rose-800 dark:text-rose-400"
                                : "bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-900 text-zinc-400"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="font-medium">{slot.label}</span>
                            </div>
                            <span className="font-semibold text-right">
                              {slot.value || (isMissing ? "Missing" : "Awaiting")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Timeline Events Feed */}
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex-1 flex flex-col min-h-[200px]">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 shrink-0">
                      <History className="h-4 w-4 text-indigo-500" />
                      <span>Pipeline Event Log</span>
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                      {activeCall.timeline.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-center text-zinc-400 p-4">
                          <span className="text-[10px]">Awaiting system pipeline signals...</span>
                        </div>
                      ) : (
                        <div className="relative border-l border-zinc-100 dark:border-zinc-800 ml-2.5 pl-4 space-y-4 text-xs">
                          {activeCall.timeline.map((evt) => (
                            <div key={evt.id} className="relative">
                              <span className="absolute -left-[21.5px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white dark:bg-zinc-950 border-2 border-indigo-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />
                              </span>
                              <div className="space-y-0.5">
                                <p className="font-semibold text-zinc-800 dark:text-zinc-200">{evt.event}</p>
                                <p className="text-[11px] text-zinc-500">{evt.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>

              {/* Call Summary Footer Section (Triggered on Complete) */}
              {activeCall.summary && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/15 dark:bg-emerald-950/10 p-4 shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">
                        Call Summary: {activeCall.summary.outcome}
                      </h4>
                      <p className="text-xs text-emerald-700 dark:text-emerald-500 mt-1">
                        {activeCall.summary.details}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="flex-1 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center p-6 text-zinc-400">
              <Info className="h-10 w-10 text-zinc-300 mb-2" />
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No Call Selected</h3>
              <p className="text-xs text-zinc-500 max-w-sm mt-1">
                Select a Call Session from the list on the left to review live transcription data and slot manager logs.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
