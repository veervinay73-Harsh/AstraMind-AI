import { WebSocket } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.DEEPGRAM_API_KEY;
console.log('API Key loaded:', apiKey);

const deepgramUrl = 'wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&interim_results=true&smart_format=true&endpointing=400';
const ws = new WebSocket(deepgramUrl, {
  headers: { Authorization: `Token ${apiKey}` },
});

ws.on('open', () => {
  console.log('✅ Connected successfully to Deepgram URL used in backend!');
  ws.close();
});

ws.on('error', (err) => {
  console.error('❌ Failed to connect:', err);
});

ws.on('close', (code, reason) => {
  console.log(`Connection closed: ${code} - ${reason}`);
});
