import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { Logger } from '../utils/logger';

const router = Router();

// ── Helper: mask an API key safely ───────────────────────────────────────────
function maskKey(key: string | undefined): string {
  if (!key || key.length < 8) return '••••••••••••••••••••••••';
  return `${key.slice(0, 4)}${'•'.repeat(20)}${key.slice(-4)}`;
}

// ── Helper: check if an env var is set (non-empty) ───────────────────────────
function isConfigured(key: string | undefined): boolean {
  return Boolean(key && key.trim().length > 0);
}

/**
 * GET /api/settings/system
 * Returns safe, read-only system configuration status.
 * NEVER exposes raw secrets.
 */
router.get('/system', async (_req: Request, res: Response) => {
  try {
    // Fetch hospital info for the first hospital
    const hospital = await prisma.hospital.findFirst({
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        timezone: true,
        createdAt: true,
      },
    });

    const env = process.env;

    res.status(200).json({
      hospital: hospital
        ? {
            id: hospital.id,
            name: hospital.name,
            phone: hospital.phone ?? '',
            address: hospital.address ?? '',
            timezone: hospital.timezone ?? 'UTC',
            since: hospital.createdAt,
          }
        : null,

      ai: {
        provider: 'Groq',
        model: env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        apiKeyConfigured: isConfigured(env.GROQ_API_KEY),
        apiKeyMasked: maskKey(env.GROQ_API_KEY),
        temperature: 0.7,
        voiceProvider: 'ElevenLabs',
      },

      livekit: {
        url: env.LIVEKIT_URL || 'Not configured',
        apiKeyConfigured: isConfigured(env.LIVEKIT_API_KEY),
        apiKeyMasked: maskKey(env.LIVEKIT_API_KEY),
        secretConfigured: isConfigured(env.LIVEKIT_API_SECRET),
        roomPrefix: 'astramind',
      },

      elevenlabs: {
        apiKeyConfigured: isConfigured(env.ELEVENLABS_API_KEY),
        apiKeyMasked: maskKey(env.ELEVENLABS_API_KEY),
        voiceId: env.ELEVENLABS_VOICE_ID || 'hpp4J3VqNfWAUOO0d1Us',
        model: 'eleven_turbo_v2',
        streaming: true,
      },

      stt: {
        provider: 'Deepgram',
        model: env.DEEPGRAM_MODEL || 'nova-2',
        language: env.DEEPGRAM_LANGUAGE || 'en-US',
        apiKeyConfigured: isConfigured(env.DEEPGRAM_API_KEY),
        apiKeyMasked: maskKey(env.DEEPGRAM_API_KEY),
        streaming: true,
      },

      security: {
        nodeEnv: env.NODE_ENV || 'development',
        maintenanceMode: env.MAINTENANCE_MODE === 'true',
        databaseConfigured: isConfigured(env.DATABASE_URL),
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        uptime: Math.round(process.uptime()),
      },
    });
  } catch (error) {
    Logger.error('Failed to load system settings', error, 'SETTINGS_API');
    res.status(500).json({ error: 'Internal server error while loading settings.' });
  }
});

/**
 * PUT /api/settings/hospital
 * Updates editable hospital information fields.
 */
router.put('/hospital', async (req: Request, res: Response) => {
  try {
    const { name, phone, address, timezone } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: 'Hospital name is required.' });
      return;
    }

    const hospital = await prisma.hospital.findFirst();
    if (!hospital) {
      res.status(404).json({ error: 'No hospital found in the database.' });
      return;
    }

    const updated = await prisma.hospital.update({
      where: { id: hospital.id },
      data: {
        name: name.trim(),
        ...(phone !== undefined && { phone: phone.trim() }),
        ...(address !== undefined && { address: address.trim() }),
        ...(timezone !== undefined && { timezone: timezone.trim() }),
      },
      select: { id: true, name: true, phone: true, address: true, timezone: true },
    });

    Logger.info(`Hospital info updated: ${hospital.id}`, 'SETTINGS_API');
    res.status(200).json(updated);
  } catch (error) {
    Logger.error('Failed to update hospital settings', error, 'SETTINGS_API');
    res.status(500).json({ error: 'Internal server error while saving hospital settings.' });
  }
});

/**
 * GET /api/settings/health
 * Returns a live health check result with DB connectivity status.
 */
router.get('/health', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: 'ok' | 'error'; detail?: string }> = {};

  // DB check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok' };
  } catch {
    checks.database = { status: 'error', detail: 'Cannot reach database' };
  }

  // Env check — required services
  const requiredEnvVars = ['DATABASE_URL', 'DEEPGRAM_API_KEY', 'GROQ_API_KEY'];
  const missingEnvVars = requiredEnvVars.filter((k) => !process.env[k]);
  checks.environment = missingEnvVars.length === 0
    ? { status: 'ok' }
    : { status: 'error', detail: `Missing: ${missingEnvVars.join(', ')}` };

  // LiveKit check
  checks.livekit = (process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && process.env.LIVEKIT_URL)
    ? { status: 'ok', detail: process.env.LIVEKIT_URL }
    : { status: 'error', detail: 'LIVEKIT credentials not set' };

  // ElevenLabs check
  checks.elevenlabs = process.env.ELEVENLABS_API_KEY
    ? { status: 'ok' }
    : { status: 'error', detail: 'ELEVENLABS_API_KEY not set' };

  const allOk = Object.values(checks).every((c) => c.status === 'ok');

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks,
  });
});

export default router;
