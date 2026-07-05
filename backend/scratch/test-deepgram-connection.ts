import { WebSocket } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.DEEPGRAM_API_KEY;
console.log('API Key loaded:', apiKey);

const deepgramUrl = 'wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&punctuate=true&paragraphs=false&filler_words=false&endpointing=500&interim_results=false';
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
