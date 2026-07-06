import { Router, Request, Response } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { Logger } from '../utils/logger';
import { isElevenLabsConfigured } from '../services/elevenLabsService';

const router = Router();

/**
 * POST /api/livekit/token
 * Generate a LiveKit JWT access token for a participant to join a room.
 */
router.post('/token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { roomName = 'astramind-session', participantName = 'Patient' } = req.body as {
      roomName?: string;
      participantName?: string;
    };

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      res.status(500).json({ error: 'LiveKit credentials not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL.' });
      return;
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: `${participantName}-${Date.now()}`,
      ttl: 3600, // 1 hour
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    Logger.info(`Generated LiveKit token for ${participantName} in room ${roomName}`, 'LIVEKIT');

    res.json({
      token,
      url: livekitUrl,
      roomName,
      participantName,
    });
  } catch (error) {
    Logger.error('Failed to generate LiveKit token', error, 'LIVEKIT');
    res.status(500).json({ error: 'Failed to generate LiveKit access token.' });
  }
});

/**
 * GET /api/livekit/status
 * Returns the current LiveKit and ElevenLabs configuration status.
 */
router.get('/status', (_req: Request, res: Response): void => {
  const livekitConfigured = !!(
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET &&
    process.env.LIVEKIT_URL
  );

  const livekitUrl = process.env.LIVEKIT_URL || '';
  const maskKey = (key: string | undefined): string => {
    if (!key || key.length < 8) return '••••••••';
    return `${key.slice(0, 4)}••••${key.slice(-4)}`;
  };

  res.json({
    livekit: {
      configured: livekitConfigured,
      url: livekitUrl,
      apiKeyMasked: maskKey(process.env.LIVEKIT_API_KEY),
      secretConfigured: !!process.env.LIVEKIT_API_SECRET,
      roomPrefix: 'astramind',
    },
    elevenlabs: {
      configured: isElevenLabsConfigured(),
      apiKeyMasked: maskKey(process.env.ELEVENLABS_API_KEY),
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'hpp4J3VqNfWAUOO0d1Us',
      model: 'eleven_turbo_v2',
      streaming: true,
    },
    session: {
      websocketPath: '/api/session',
      stt: 'Deepgram Nova-2',
      ai: 'Groq llama-3.3-70b-versatile',
    },
  });
});

export default router;
