import { Logger } from '../utils/logger';

/**
 * Synthesize text to speech using ElevenLabs REST API.
 * Returns an MP3 audio Buffer, or null if TTS is not configured.
 */
export const synthesizeSpeech = async (text: string): Promise<Buffer | null> => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    Logger.info('ELEVENLABS_API_KEY not set, skipping TTS.', 'ELEVENLABS');
    return null;
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

  try {
    Logger.info(`Sending request to ElevenLabs TTS API for voice ID: ${voiceId} with text: "${text.slice(0, 60)}..."`, 'ELEVENLABS');
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2',
          output_format: 'mp3_44100_128',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    Logger.info(`ElevenLabs synthesized ${buffer.length} bytes of audio for: "${text.slice(0, 60)}..."`, 'ELEVENLABS');
    return buffer;
  } catch (error) {
    Logger.error('ElevenLabs TTS synthesis failed', error, 'ELEVENLABS');
    return null;
  }
};

export const isElevenLabsConfigured = (): boolean => !!process.env.ELEVENLABS_API_KEY;
