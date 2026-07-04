'use client';

import { VoiceStatus } from '../../hooks/useVoiceSession';

interface ConnectionStatusProps {
  status: VoiceStatus;
}

const STATUS_CONFIG: Record<VoiceStatus, { label: string; color: string; dot: string }> = {
  idle:         { label: 'Ready',        color: 'text-zinc-500',                dot: 'bg-zinc-400' },
  connecting:   { label: 'Connecting…',  color: 'text-amber-600 dark:text-amber-400',    dot: 'bg-amber-400 animate-pulse' },
  listening:    { label: 'Listening',    color: 'text-indigo-600 dark:text-indigo-400',  dot: 'bg-indigo-500 animate-pulse' },
  thinking:     { label: 'Thinking…',   color: 'text-purple-600 dark:text-purple-400',  dot: 'bg-purple-500 animate-ping' },
  speaking:     { label: 'Speaking',     color: 'text-emerald-600 dark:text-emerald-400',dot: 'bg-emerald-500 animate-bounce' },
  error:        { label: 'Error',        color: 'text-rose-600 dark:text-rose-400',      dot: 'bg-rose-500' },
  disconnected: { label: 'Disconnected', color: 'text-zinc-400',               dot: 'bg-zinc-400' },
};

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cfg.color}`}>
      <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
