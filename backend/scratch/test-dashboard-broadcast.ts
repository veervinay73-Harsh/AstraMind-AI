import { WebSocket } from 'ws';
import { setTimeout } from 'timers/promises';

async function runDashboardBroadcastTest() {
  console.log("🚀 Starting Real-Time Dashboard WebSocket Broadcast Integration Test...\n");

  const dashboardEvents: any[] = [];

  // 1. Establish Dashboard connection
  console.log("🔌 Connecting Dashboard client to ws://localhost:5000/api/dashboard...");
  const dashboardWs = new WebSocket('ws://localhost:5000/api/dashboard');

  dashboardWs.on('message', (message: string) => {
    const data = JSON.parse(message);
    console.log(`📥 [Dashboard Received]: Event "${data.event}" | CallSid: ${data.callSid}`);
    dashboardEvents.push(data);
  });

  dashboardWs.on('open', () => {
    console.log("✅ Dashboard client connected successfully.");
  });

  dashboardWs.on('error', (err) => {
    console.error("❌ Dashboard WebSocket Client Error:", err);
  });

  await setTimeout(1000);

  // 2. Establish Voice Stream connection (simulating Twilio)
  const callerPhone = "%2B15557778888"; // +15557778888
  const hospitalPhone = "%2B15558880000"; // +15558880000
  console.log(`🔌 Connecting Twilio Voice Stream client to ws://localhost:5000/api/voice-stream?callerPhone=${callerPhone}&hospitalPhone=${hospitalPhone}...`);
  const twilioWs = new WebSocket(`ws://localhost:5000/api/voice-stream?callerPhone=${callerPhone}&hospitalPhone=${hospitalPhone}`);

  twilioWs.on('open', async () => {
    console.log("✅ Twilio Voice Stream client connected successfully.\n");

    // --- STEP 1: Start Call ---
    console.log("🎙️ Sending start call event...");
    twilioWs.send(JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'test_dashboard_stream_999',
        callSid: 'test_dashboard_call_999',
      }
    }));

    await setTimeout(1500);

    // --- STEP 2: Send Media Packet ---
    console.log("🎙️ Sending media packet (simulates voice packets)...");
    twilioWs.send(JSON.stringify({
      event: 'media',
      media: {
        payload: 'dGVzdF9hdWRpb19wYWNrZXRfZHVtbXlfYmFzZTY0X2RhdGE=',
      }
    }));

    await setTimeout(1500);

    // --- STEP 3: Stop Call ---
    console.log("🎙️ Sending stop call event...");
    twilioWs.send(JSON.stringify({
      event: 'stop',
      stop: {
        streamSid: 'test_dashboard_stream_999',
      }
    }));

    await setTimeout(1500);
    twilioWs.close();
  });

  twilioWs.on('error', (err) => {
    console.error("❌ Twilio WebSocket Client Error:", err);
  });

  // Keep test script alive to capture events
  await setTimeout(5000);
  dashboardWs.close();

  // 3. Verify results
  console.log("\n📊 Verification Metrics:");
  const eventTypes = dashboardEvents.map(e => e.event);
  console.log("Captured dashboard events:", eventTypes);

  const hasCallStarted = eventTypes.includes('call_started');
  const hasAiStatusChange = eventTypes.includes('ai_status_change');
  const hasCallEnded = eventTypes.includes('call_ended');

  if (hasCallStarted && hasAiStatusChange && hasCallEnded) {
    console.log("\n✅ SUCCESS: All live broadcast events successfully passed through the real-time WebSocket dashboard pipeline!");
    process.exit(0);
  } else {
    console.error("\n❌ FAILURE: Missing live broadcast events in the dashboard queue.");
    process.exit(1);
  }
}

runDashboardBroadcastTest().catch((err) => {
  console.error("Fatal Test Error:", err);
  process.exit(1);
});
