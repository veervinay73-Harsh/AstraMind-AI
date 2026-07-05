"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

export interface TranscriptItem {
  id: string;
  text: string;
  isFinal: boolean;
  speaker: "patient" | "ai";
  timestamp: string;
}

export interface TimelineEvent {
  id: string;
  event: string;
  description: string;
  timestamp: string;
}

export interface CallSession {
  callSid: string;
  callerPhone: string;
  hospitalPhone: string;
  status: "active" | "completed";
  aiStatus: "listening" | "thinking" | "speaking" | "idle";
  intent: string;
  state: {
    patient_name?: string | null;
    doctor?: string | null;
    date?: string | null;
    time?: string | null;
    phone?: string | null;
    missing_fields: string[];
  };
  transcripts: TranscriptItem[];
  timeline: TimelineEvent[];
  summary: {
    outcome: string;
    details?: string;
  } | null;
  startTime: string;
  endTime?: string;
}

interface LiveCallsContextType {
  calls: Record<string, CallSession>;
  isConnected: boolean;
  isConnecting: boolean;
  activeCallId: string | null;
  setActiveCallId: (id: string | null) => void;
}

const LiveCallsContext = createContext<LiveCallsContextType | undefined>(undefined);

export function LiveCallsProvider({ children }: { children: React.ReactNode }) {
  const [calls, setCalls] = useState<Record<string, CallSession>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    setIsConnecting(true);
    // Connect to backend dashboard stream path
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ? (process.env.NEXT_PUBLIC_WS_URL.endsWith('/api/dashboard') ? process.env.NEXT_PUBLIC_WS_URL : process.env.NEXT_PUBLIC_WS_URL.replace(/\/$/, '') + '/api/dashboard') : "ws://localhost:5000/api/dashboard";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      reconnectAttemptsRef.current = 0;
      console.log("Dashboard WebSocket stream connected successfully.");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { event: eventName, callSid } = data;

        setCalls((prevCalls) => {
          const currentCall = prevCalls[callSid] || {
            callSid,
            callerPhone: data.callerPhone || "Unknown",
            hospitalPhone: data.hospitalPhone || "",
            status: "active",
            aiStatus: "idle",
            intent: "UNKNOWN",
            state: { missing_fields: [] },
            transcripts: [],
            timeline: [],
            summary: null,
            startTime: data.timestamp || new Date().toISOString(),
          };

          const updatedCall = { ...currentCall };

          switch (eventName) {
            case "call_started":
              updatedCall.status = "active";
              updatedCall.startTime = data.timestamp;
              updatedCall.callerPhone = data.callerPhone;
              updatedCall.hospitalPhone = data.hospitalPhone;
              updatedCall.timeline = [
                ...updatedCall.timeline,
                {
                  id: Math.random().toString(),
                  event: "Call Connected",
                  description: `Call established from ${data.callerPhone}`,
                  timestamp: data.timestamp,
                },
              ];
              // Set as active selected call
              setActiveCallId(callSid);
              break;

            case "ai_status_change":
              updatedCall.aiStatus = data.status;
              break;

            case "transcript_received":
              // For transcripts, check if we need to replace the last interim transcript or add a new one
              const lastTranscriptIndex = updatedCall.transcripts.findLastIndex(
                (t) => t.speaker === "patient" && !t.isFinal
              );

              const newTranscript: TranscriptItem = {
                id: Math.random().toString(),
                text: data.transcript,
                isFinal: data.isFinal,
                speaker: "patient",
                timestamp: data.timestamp || new Date().toISOString(),
              };

              if (lastTranscriptIndex !== -1) {
                const updatedTranscripts = [...updatedCall.transcripts];
                updatedTranscripts[lastTranscriptIndex] = newTranscript;
                updatedCall.transcripts = updatedTranscripts;
              } else {
                updatedCall.transcripts = [...updatedCall.transcripts, newTranscript];
              }
              break;

            case "tool_executed":
              updatedCall.intent = data.state?.intent || updatedCall.intent;
              updatedCall.state = data.state || updatedCall.state;
              
              let desc = `Intent classified: ${data.tool.replace("_", " ")}`;
              if (data.reason) desc += `. ${data.reason}`;

              updatedCall.timeline = [
                ...updatedCall.timeline,
                {
                  id: Math.random().toString(),
                  event: "Orchestration Decision",
                  description: desc,
                  timestamp: new Date().toISOString(),
                },
              ];
              break;

            case "ai_response_generated":
              updatedCall.transcripts = [
                ...updatedCall.transcripts,
                {
                  id: Math.random().toString(),
                  text: data.response,
                  isFinal: true,
                  speaker: "ai",
                  timestamp: data.timestamp || new Date().toISOString(),
                },
              ];
              break;

            case "call_ended":
              updatedCall.status = "completed";
              updatedCall.endTime = data.timestamp;
              updatedCall.aiStatus = "idle";
              
              // Compile call outcome summary
              let outcome = "Call Ended";
              let details = "The caller hung up.";
              
              if (updatedCall.intent === "BOOK_APPOINTMENT" && updatedCall.state?.patient_name) {
                outcome = "Appointment Booked";
                details = `Booked with ${updatedCall.state.doctor || "doctor"} on ${updatedCall.state.date} at ${updatedCall.state.time}`;
              } else if (updatedCall.intent === "CANCEL_APPOINTMENT") {
                outcome = "Appointment Cancelled";
                details = `Cancelled booking for Dr. Smith`;
              } else if (updatedCall.intent === "RESCHEDULE_APPOINTMENT") {
                outcome = "Appointment Rescheduled";
                details = `Rescheduled to ${updatedCall.state?.date} at ${updatedCall.state?.time}`;
              } else if (updatedCall.intent === "TALK_TO_HUMAN") {
                outcome = "Transferred to Staff";
                details = "Call routed to human receptionist.";
              }

              updatedCall.summary = { outcome, details };
              updatedCall.timeline = [
                ...updatedCall.timeline,
                {
                  id: Math.random().toString(),
                  event: "Call Closed",
                  description: outcome,
                  timestamp: data.timestamp,
                },
              ];
              break;
          }

          return { ...prevCalls, [callSid]: updatedCall };
        });
      } catch (err) {
        console.error("Failed to parse WebSocket message", err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
      console.log("Dashboard WebSocket disconnected.");
      
      // Auto-reconnect with exponential backoff (max 30s)
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current += 1;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`Attempting to reconnect WebSocket (Attempt #${reconnectAttemptsRef.current})...`);
        connectWebSocket();
      }, delay);
    };

    ws.onerror = (err) => {
      console.error("WebSocket connection encountered an error:", err);
    };
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return (
    <LiveCallsContext.Provider value={{ calls, isConnected, isConnecting, activeCallId, setActiveCallId }}>
      {children}
    </LiveCallsContext.Provider>
  );
}

export function useLiveCalls() {
  const context = useContext(LiveCallsContext);
  if (context === undefined) {
    throw new Error("useLiveCalls must be used within a LiveCallsProvider");
  }
  return context;
}
