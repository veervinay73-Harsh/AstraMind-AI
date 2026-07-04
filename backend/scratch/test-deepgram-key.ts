import { WebSocket } from 'ws';
import dotenv from 'dotenv';

// Load env variables
dotenv.config({ path: 'C:/Users/Vinay GV/OneDrive/Pictures/Documents/AstraMind-AI/backend/.env' });

const apiKey = process.env.DEEPGRAM_API_KEY;
console.log('API Key loaded from env:', apiKey);
console.log('Cleaned API Key (no quotes):', apiKey?.replace(/^"|"$/g, ''));

async function testConnection(url: string) {
  console.log(`\nConnecting to: ${url}`);
  const cleanKey = apiKey?.replace(/^"|"$/g, '');
  const ws = new WebSocket(url, {
    headers: {
      Authorization: `Token ${cleanKey}`,
    },
  });

  ws.on('open', () => {
    console.log('✅ Connection opened successfully!');
    ws.close();
  });

  ws.on('error', (err: any) => {
    console.error('❌ Connection failed:', err.message || err);
  });

  ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed. Code: ${code}, Reason: ${reason}`);
  });
}

async function start() {
  // Test 1: Original URL
  await testConnection('wss://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000&channels=1&model=nova-2-phone&punctuate=true&interim_results=true');
  
  // Test 2: Standard model with encoding and sample rate
  await testConnection('wss://api.deepgram.com/v1/listen?model=nova-2&encoding=mulaw&sample_rate=8000');

  // Test 3: Standard model without encoding and sample rate
  await testConnection('wss://api.deepgram.com/v1/listen?model=nova-2');
  
  // Test 4: Original URL but changing model to nova-2
  await testConnection('wss://api.deepgram.com/v1/listen?encoding=mulaw&sample_rate=8000&channels=1&model=nova-2&punctuate=true&interim_results=true');
}

start();
