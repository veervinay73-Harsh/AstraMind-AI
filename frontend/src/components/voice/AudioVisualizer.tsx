'use client';

import { VoiceStatus } from '../../hooks/useVoiceSession';

interface AudioVisualizerProps {
  status: VoiceStatus;
  barCount?: number;
}

export function AudioVisualizer({ status, barCount = 5 }: AudioVisualizerProps) {
  const isActive = status === 'listening' || status === 'speaking';
  const isSpeaking = status === 'speaking';

  const bars = Array.from({ length: barCount }, (_, i) => i);

  const getBarStyle = (i: number): string => {
    if (!isActive) return 'h-1';
    const heights = isSpeaking
      ? ['h-8', 'h-5', 'h-10', 'h-6', 'h-9', 'h-4', 'h-7']
      : ['h-3', 'h-6', 'h-4', 'h-7', 'h-2', 'h-5', 'h-3'];
    return heights[i % heights.length];
  };

  const getDelay = (i: number): string => {
    const delays = ['0ms', '100ms', '200ms', '50ms', '150ms', '250ms', '75ms'];
    return delays[i % delays.length];
  };

  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {bars.map((i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all ${getBarStyle(i)} ${
            isActive
              ? isSpeaking
                ? 'bg-emerald-500 dark:bg-emerald-400'
                : 'bg-indigo-500 dark:bg-indigo-400'
              : 'bg-zinc-300 dark:bg-zinc-700'
          }`}
          style={{
            animationName: isActive ? 'voicePulse' : 'none',
            animationDuration: '0.8s',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
            animationDelay: getDelay(i),
          }}
        />
      ))}

      <style>{`
        @keyframes voicePulse {
          0% { transform: scaleY(0.4); opacity: 0.6; }
          100% { transform: scaleY(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
