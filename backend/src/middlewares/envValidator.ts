import { z } from 'zod';
import { Logger } from '../utils/logger';

const envSchema = z.object({
  PORT: z.string().default('5000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL connection string is required'),
  DEEPGRAM_API_KEY: z.string().min(1, 'DEEPGRAM_API_KEY is required for speech-to-text'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required for AI orchestration'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MAINTENANCE_MODE: z.enum(['true', 'false']).default('false'),
  // LiveKit — optional (warns if missing, does not block startup)
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  // ElevenLabs — optional (falls back to text-only if missing)
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
});

export const validateEnv = (): void => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    Logger.error('❌ Environment validation failed! Missing or invalid variables:');
    result.error.issues.forEach((err) => {
      Logger.error(`   - ${err.path.join('.')}: ${err.message}`);
    });
    // Critical failure on start prevents loading unstable environment configurations
    process.exit(1);
  }

  // Warn about optional but recommended services
  if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    Logger.info('⚠️  LiveKit credentials not fully configured. Token generation will be unavailable.', 'ENV');
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    Logger.info('⚠️  ELEVENLABS_API_KEY not set. Voice responses will be text-only.', 'ENV');
  }

  Logger.info('✅ Environment configurations successfully loaded & validated.');
};

