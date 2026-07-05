import dotenv from 'dotenv';
import { synthesizeSpeech } from '../src/services/elevenLabsService';

dotenv.config();

async function testElevenLabs() {
  console.log('Testing ElevenLabs speech synthesis...');
  console.log('ELEVENLABS_API_KEY:', process.env.ELEVENLABS_API_KEY ? 'Present' : 'Missing');
  console.log('ELEVENLABS_VOICE_ID:', process.env.ELEVENLABS_VOICE_ID || 'Default');

  try {
    const buffer = await synthesizeSpeech('Hello, this is a test of the AstraMind voice synthesis pipeline.');
    if (buffer) {
      console.log(`✅ Success! Received ${buffer.length} bytes of audio.`);
    } else {
      console.error('❌ Failed! synthesizeSpeech returned null.');
    }
  } catch (err) {
    console.error('❌ Synthesize speech crashed with error:', err);
  }
}

testElevenLabs();
