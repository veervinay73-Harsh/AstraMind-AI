"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  BrainCircuit,
  Phone,
  Mic,
  ShieldCheck,
  Bell,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Globe,
  Clock,
  Activity,
  Server,
  Key,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HospitalConfig {
  id: string;
  name: string;
  phone: string;
  address: string;
  timezone: string;
  since: string;
}

interface AIConfig {
  provider: string;
  model: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  temperature: number;
  voiceProvider: string;
}

interface LiveKitConfig {
  url: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  secretConfigured: boolean;
  roomPrefix: string;
}

interface ElevenLabsConfig {
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  voiceId: string;
  model: string;
  streaming: boolean;
}

interface STTConfig {
  provider: string;
  model: string;
  language: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  streaming: boolean;
}

interface SecurityConfig {
  nodeEnv: string;
  maintenanceMode: boolean;
  databaseConfigured: boolean;
  version: string;
  nodeVersion: string;
  uptime: number;
}

interface SystemConfig {
  hospital: HospitalConfig | null;
  ai: AIConfig;
  livekit: LiveKitConfig;
  elevenlabs: ElevenLabsConfig;
  stt: STTConfig;
  security: SecurityConfig;
}

interface HealthCheck {
  status: "healthy" | "degraded";
  uptime: number;
  timestamp: string;
  checks: Record<string, { status: "ok" | "error"; detail?: string }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ? (process.env.NEXT_PUBLIC_API_URL.endsWith('/api') ? process.env.NEXT_PUBLIC_API_URL : process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') + '/api') : "http://localhost:5000/api");

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  ok,
  okLabel = "Configured",
  failLabel = "Not Configured",
}: {
  ok: boolean;
  okLabel?: string;
  failLabel?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
        ok
          ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
          : "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {ok ? okLabel : failLabel}
    </span>
  );
}

// ─── Section Card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  iconColor = "text-indigo-500",
  iconBg = "bg-indigo-50 dark:bg-indigo-950/20",
  children,
  action,
}: {
  title: string;
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-900">
        <div className="flex items-center gap-3">
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
          <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden animate-pulse">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-100 dark:border-zinc-900">
        <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-36 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>
      <div className="p-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    </div>
  );
}

// ─── Masked Key Field ─────────────────────────────────────────────────────────

function MaskedKeyField({ label, masked, configured }: { label: string; masked: string; configured: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-zinc-500">{label}</label>
        <StatusBadge ok={configured} />
      </div>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={masked}
          readOnly
          className="w-full h-9 pl-3 pr-10 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-xs font-mono text-zinc-500 focus:outline-none"
        />
        <button
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ─── Notification Toggle ──────────────────────────────────────────────────────

function NotifToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-900 last:border-0">
      <div>
        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{label}</p>
        <p className="text-[10px] text-zinc-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
          value ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform ${
            value ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-50 dark:border-zinc-900/50 last:border-0">
      <span className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0">
        {Icon && <Icon className="h-3.5 w-3.5 text-zinc-400" />}
        {label}
      </span>
      <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 text-right truncate max-w-[200px]">
        {value}
      </span>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hospital edit form state
  const [hospitalForm, setHospitalForm] = useState({
    name: "",
    phone: "",
    address: "",
    timezone: "UTC",
  });
  const [isSavingHospital, setIsSavingHospital] = useState(false);
  const [hospitalSaveMsg, setHospitalSaveMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Notification preferences (local state only — no backend)
  const [notifs, setNotifs] = useState({
    emergencyTransfers: true,
    slotConflicts: true,
    newAppointments: false,
    cancellations: true,
    browserPush: false,
  });

  // ── Load system config ─────────────────────────────────────────────────────
  const fetchConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/settings/system`);
      if (!res.ok) throw new Error("Failed to load system configuration.");
      const data: SystemConfig = await res.json();
      setConfig(data);
      // Pre-fill hospital form
      if (data.hospital) {
        setHospitalForm({
          name: data.hospital.name,
          phone: data.hospital.phone,
          address: data.hospital.address,
          timezone: data.hospital.timezone,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // ── Live health check ──────────────────────────────────────────────────────
  const runHealthCheck = async () => {
    setIsHealthLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/settings/health`);
      const data: HealthCheck = await res.json();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setIsHealthLoading(false);
    }
  };

  // Run health check once on load
  useEffect(() => {
    runHealthCheck();
  }, []);

  // ── Save hospital settings ─────────────────────────────────────────────────
  const handleSaveHospital = async () => {
    if (!hospitalForm.name.trim()) {
      setHospitalSaveMsg({ type: "error", text: "Hospital name cannot be empty." });
      return;
    }
    setIsSavingHospital(true);
    setHospitalSaveMsg(null);
    try {
      const res = await fetch(`${BASE_URL}/settings/hospital`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hospitalForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Save failed.");
      }
      const updated = await res.json();
      setConfig((prev) => prev ? { ...prev, hospital: { ...prev.hospital!, ...updated } } : prev);
      setHospitalSaveMsg({ type: "success", text: "Hospital information saved successfully." });
      setTimeout(() => setHospitalSaveMsg(null), 4000);
    } catch (err: unknown) {
      setHospitalSaveMsg({ type: "error", text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setIsSavingHospital(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">

      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Settings & Configuration
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Hospital administration, AI configuration, and system health.
          </p>
        </div>
        <button
          onClick={fetchConfig}
          disabled={isLoading}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50 transition-colors shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 text-sm text-rose-600 dark:text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchConfig} className="ml-auto text-xs font-semibold hover:underline flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left column: 2/3 width ─────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-6">

          {/* 1. Hospital Information */}
          {isLoading ? <SectionSkeleton /> : (
            <SectionCard
              title="Hospital Information"
              icon={Building2}
              iconColor="text-indigo-600 dark:text-indigo-400"
              iconBg="bg-indigo-50 dark:bg-indigo-950/20"
              action={
                <button
                  onClick={handleSaveHospital}
                  disabled={isSavingHospital}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
                >
                  {isSavingHospital ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </button>
              }
            >
              <div className="space-y-4">
                {hospitalSaveMsg && (
                  <div className={`flex items-center gap-2 rounded-lg p-3 text-xs font-medium ${
                    hospitalSaveMsg.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                      : "bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400"
                  }`}>
                    {hospitalSaveMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                    {hospitalSaveMsg.text}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { label: "Hospital Name", key: "name", placeholder: "AstraMind General Hospital" },
                    { label: "Phone Number", key: "phone", placeholder: "+1 (555) 000-0000" },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key} className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{label}</label>
                      <input
                        type="text"
                        value={hospitalForm[key as keyof typeof hospitalForm]}
                        onChange={(e) => setHospitalForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm placeholder-zinc-400 focus:outline-none focus:border-indigo-500 dark:text-zinc-200"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Address</label>
                  <input
                    type="text"
                    value={hospitalForm.address}
                    onChange={(e) => setHospitalForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="123 Medical Center Drive, City, State 12345"
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm placeholder-zinc-400 focus:outline-none focus:border-indigo-500 dark:text-zinc-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Timezone
                  </label>
                  <select
                    value={hospitalForm.timezone}
                    onChange={(e) => setHospitalForm((f) => ({ ...f, timezone: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-indigo-500"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                {config?.hospital && (
                  <InfoRow
                    label="Hospital ID"
                    value={config.hospital.id}
                    icon={Key}
                  />
                )}
              </div>
            </SectionCard>
          )}

          {/* 2. AI Configuration */}
          {isLoading ? <SectionSkeleton /> : config && (
            <SectionCard
              title="AI Configuration"
              icon={BrainCircuit}
              iconColor="text-violet-600 dark:text-violet-400"
              iconBg="bg-violet-50 dark:bg-violet-950/20"
            >
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Provider</label>
                    <div className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                      {config.ai.provider}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Model</label>
                    <div className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {config.ai.model}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Temperature</label>
                    <div className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                      {config.ai.temperature} (display only)
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Voice Provider</label>
                    <div className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center text-sm text-zinc-600 dark:text-zinc-400">
                      {config.ai.voiceProvider}
                    </div>
                  </div>
                </div>

                <MaskedKeyField
                  label="Groq API Key"
                  masked={config.ai.apiKeyMasked}
                  configured={config.ai.apiKeyConfigured}
                />
              </div>
            </SectionCard>
          )}

          {/* 3. LiveKit Configuration */}
          {isLoading ? <SectionSkeleton /> : config && (
            <SectionCard
              title="LiveKit Configuration"
              icon={Phone}
              iconColor="text-sky-600 dark:text-sky-400"
              iconBg="bg-sky-50 dark:bg-sky-950/20"
            >
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Server URL</label>
                    <div className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center text-xs font-mono text-zinc-600 dark:text-zinc-400 overflow-hidden truncate">
                      {config.livekit.url || 'Not configured'}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Room Prefix</label>
                    <div className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {config.livekit.roomPrefix}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <MaskedKeyField
                    label="API Key"
                    masked={config.livekit.apiKeyMasked}
                    configured={config.livekit.apiKeyConfigured}
                  />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">API Secret</label>
                      <StatusBadge ok={config.livekit.secretConfigured} />
                    </div>
                    <input
                      type="password"
                      value="••••••••••••••••••••••••"
                      readOnly
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 text-xs font-mono text-zinc-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          {/* 3b. ElevenLabs TTS Configuration */}
          {isLoading ? <SectionSkeleton /> : config && (
            <SectionCard
              title="ElevenLabs Text-to-Speech"
              icon={Mic}
              iconColor="text-violet-600 dark:text-violet-400"
              iconBg="bg-violet-50 dark:bg-violet-950/20"
            >
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Model</label>
                    <div className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center text-sm font-mono text-zinc-600 dark:text-zinc-400">
                      {config.elevenlabs.model}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Voice ID</label>
                    <div className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center text-xs font-mono text-zinc-600 dark:text-zinc-400">
                      {config.elevenlabs.voiceId}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Real-time Streaming</span>
                  </div>
                  <StatusBadge ok={config.elevenlabs.streaming} okLabel="Enabled" failLabel="Disabled" />
                </div>

                <MaskedKeyField
                  label="ElevenLabs API Key"
                  masked={config.elevenlabs.apiKeyMasked}
                  configured={config.elevenlabs.apiKeyConfigured}
                />
              </div>
            </SectionCard>
          )}

          {/* 4. Speech-to-Text */}
          {isLoading ? <SectionSkeleton /> : config && (
            <SectionCard
              title="Speech-to-Text (STT)"
              icon={Mic}
              iconColor="text-teal-600 dark:text-teal-400"
              iconBg="bg-teal-50 dark:bg-teal-950/20"
            >
              <div className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { label: "Provider", value: config.stt.provider },
                    { label: "Model", value: config.stt.model },
                    { label: "Language", value: config.stt.language },
                  ].map(({ label, value }) => (
                    <div key={label} className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{label}</label>
                      <div className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center text-sm font-mono text-zinc-600 dark:text-zinc-400">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/20">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Real-time Streaming</span>
                  </div>
                  <StatusBadge ok={config.stt.streaming} okLabel="Enabled" failLabel="Disabled" />
                </div>

                <MaskedKeyField
                  label="Deepgram API Key"
                  masked={config.stt.apiKeyMasked}
                  configured={config.stt.apiKeyConfigured}
                />
              </div>
            </SectionCard>
          )}

        </div>

        {/* ── Right column: 1/3 width ─────────────────────────────────────── */}
        <div className="space-y-6">

          {/* 5. Security & System Status */}
          {isLoading ? <SectionSkeleton /> : config && (
            <SectionCard
              title="Security & System"
              icon={ShieldCheck}
              iconColor="text-amber-600 dark:text-amber-400"
              iconBg="bg-amber-50 dark:bg-amber-950/20"
            >
              <div className="space-y-2">
                <InfoRow
                  label="Environment"
                  value={config.security.nodeEnv}
                  icon={Server}
                />
                <InfoRow
                  label="Maintenance Mode"
                  value={config.security.maintenanceMode ? "ON" : "OFF"}
                  icon={Activity}
                />
                <InfoRow
                  label="Database"
                  value={config.security.databaseConfigured ? "Connected" : "Not Configured"}
                  icon={Key}
                />
                <InfoRow
                  label="Backend Version"
                  value={`v${config.security.version}`}
                  icon={Server}
                />
                <InfoRow
                  label="Node.js"
                  value={config.security.nodeVersion}
                  icon={Server}
                />
                <InfoRow
                  label="Uptime"
                  value={formatUptime(config.security.uptime)}
                  icon={Clock}
                />
              </div>
            </SectionCard>
          )}

          {/* 6. Live Health Check */}
          <SectionCard
            title="System Health Check"
            icon={Activity}
            iconColor="text-emerald-600 dark:text-emerald-400"
            iconBg="bg-emerald-50 dark:bg-emerald-950/20"
            action={
              <button
                onClick={runHealthCheck}
                disabled={isHealthLoading}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isHealthLoading ? "animate-spin" : ""}`} />
                Run
              </button>
            }
          >
            {isHealthLoading ? (
              <div className="space-y-2 animate-pulse">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-9 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
                ))}
              </div>
            ) : health ? (
              <div className="space-y-3">
                {/* Overall status */}
                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  health.status === "healthy"
                    ? "border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/10"
                    : "border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/10"
                }`}>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Overall Status</span>
                  <span className={`text-xs font-bold capitalize ${health.status === "healthy" ? "text-emerald-600" : "text-rose-600"}`}>
                    {health.status === "healthy" ? "✓" : "✗"} {health.status}
                  </span>
                </div>

                {/* Individual checks */}
                {Object.entries(health.checks || {}).map(([name, check]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 capitalize">{name}</span>
                    <div className="flex items-center gap-2">
                      {check.detail && (
                        <span className="text-[10px] text-zinc-400 italic">{check.detail}</span>
                      )}
                      <StatusBadge ok={check.status === "ok"} okLabel="OK" failLabel="Error" />
                    </div>
                  </div>
                ))}

                <p className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-900">
                  Uptime: {formatUptime(health.uptime)} · Checked at {new Date(health.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-zinc-400">
                <Activity className="h-6 w-6 text-zinc-300 mb-2" />
                <p className="text-xs">Click Run to check system health.</p>
              </div>
            )}
          </SectionCard>

          {/* 7. Notification Preferences */}
          <SectionCard
            title="Notification Preferences"
            icon={Bell}
            iconColor="text-rose-600 dark:text-rose-400"
            iconBg="bg-rose-50 dark:bg-rose-950/20"
          >
            <div className="space-y-0">
              <NotifToggle
                label="Emergency Transfers"
                description="Alert when call is handed off to a human"
                value={notifs.emergencyTransfers}
                onChange={(v) => setNotifs((n) => ({ ...n, emergencyTransfers: v }))}
              />
              <NotifToggle
                label="Slot Conflicts"
                description="Alert on scheduling failures or double-bookings"
                value={notifs.slotConflicts}
                onChange={(v) => setNotifs((n) => ({ ...n, slotConflicts: v }))}
              />
              <NotifToggle
                label="New Appointments"
                description="Notify when AI books a new appointment"
                value={notifs.newAppointments}
                onChange={(v) => setNotifs((n) => ({ ...n, newAppointments: v }))}
              />
              <NotifToggle
                label="Cancellations"
                description="Notify when an appointment is cancelled"
                value={notifs.cancellations}
                onChange={(v) => setNotifs((n) => ({ ...n, cancellations: v }))}
              />
              <NotifToggle
                label="Browser Push"
                description="Enable browser desktop notifications"
                value={notifs.browserPush}
                onChange={(v) => setNotifs((n) => ({ ...n, browserPush: v }))}
              />
            </div>

            <button className="mt-4 w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
              <Save className="h-4 w-4" />
              Save Preferences
            </button>
          </SectionCard>

        </div>
      </div>
    </div>
  );
}
