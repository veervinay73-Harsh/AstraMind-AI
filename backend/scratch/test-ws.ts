import { WebSocket } from 'ws';
import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function runTest() {
  console.log('🚀 Starting backend dev server...');
  
  const server = spawn('npx', ['nodemon', 'src/index.ts'], {
    cwd: 'C:/Users/Vinay GV/OneDrive/Pictures/Documents/AstraMind-AI/backend',
    shell: true,
  });

  server.stdout.on('data', (data) => {
    console.log(`[Server stdout]: ${data.toString().trim()}`);
  });

  server.stderr.on('data', (data) => {
    console.error(`[Server stderr]: ${data.toString().trim()}`);
  });

  // Wait for server to boot up
  await setTimeout(5000);

  console.log('🔌 Connecting to WebSocket voice stream...');
  const ws = new WebSocket('ws://localhost:5000/api/voice-stream');

  ws.on('open', async () => {
    console.log('✅ Connected successfully! Sending start event...');
    
    ws.send(JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'test_stream_sid_777',
        callSid: 'test_call_sid_888',
      }
    }));

    await setTimeout(500);

    console.log('🎙️ Sending 105 mock media audio packets (this triggers logging)...');
    for (let i = 1; i <= 105; i++) {
      ws.send(JSON.stringify({
        event: 'media',
        media: {
          payload: 'dGVzdF9hdWRpb19wYWNrZXRfZHVtbXlfYmFzZTY0X2RhdGE=',
        }
      }));
      // Rapid stream emulation
      await setTimeout(10);
    }

    await setTimeout(500);

    console.log('🛑 Sending stop event...');
    ws.send(JSON.stringify({
      event: 'stop',
      stop: {
        streamSid: 'test_stream_sid_777',
      }
    }));

    await setTimeout(500);
    ws.close();
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket disconnected.');
  });

  ws.on('error', (err: any) => {
    console.error('❌ WebSocket Client Error:', err);
  });

  // Let client finish operations
  await setTimeout(4000);

  console.log('🛑 Stopping backend dev server...');
  server.kill('SIGINT');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
