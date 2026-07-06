import { WebSocket } from 'ws';
import { orchestrateTurn } from '../src/services/orchestrator';
import { clearSessionState, getSessionState } from '../src/services/stateManager';
import prisma from '../src/config/prisma';

const DASHBOARD_WS_URL = 'ws://localhost:5000/api/dashboard';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runE2E() {
  console.log("=== STARTING END-TO-END VERIFICATION ===");

  const dashboardWs = new WebSocket(DASHBOARD_WS_URL);
  
  const messages: any[] = [];
  dashboardWs.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    messages.push(msg);
    if (msg.type === 'REFRESH_DASHBOARD' || msg.event === 'REFRESH_DASHBOARD') {
      console.log(`[DASHBOARD WS] Received REFRESH_DASHBOARD event`);
    } else {
      console.log(`[DASHBOARD WS] Event: ${msg.event} | Type: ${msg.type}`);
    }
  });

  await new Promise((resolve, reject) => {
    dashboardWs.on('open', resolve);
    dashboardWs.on('error', reject);
  });
  console.log("Dashboard WebSocket connected.");

  // Pre-requisite: ensure Dr. Robert Smith exists
  const doctor = await prisma.doctor.findFirst({ where: { name: 'Dr. Robert Smith' } });
  if (!doctor) {
    console.error("Dr. Robert Smith not found in DB!");
    process.exit(1);
  }

  const hospitalId = doctor.hospitalId;
  const callerPhone = '810-555-8817';

  // --- Scenario 1: YES ---
  const callSid1 = 'e2e-test-1';
  clearSessionState(callSid1);

  console.log("\n--- Scenario 1: Book Appointment (YES) ---");
  
  const utterances1 = [
    "I want to book an appointment.",
    "My name is Vinay",
    "810-555-8817",
    "Dr. Robert Smith",
    "July 7, 2026",
    "2:00 PM"
  ];

  for (const utterance of utterances1) {
    console.log(`\nUser: "${utterance}"`);
    const result = await orchestrateTurn(callSid1, utterance, hospitalId, callerPhone);
    const state = getSessionState(callSid1);
    console.log(`AI state: ${state.state}`);
    console.log(`Collected fields: patient_name=${state.patient_name}, phone=${state.phone}, doctor=${state.doctor}, date=${state.date}, time=${state.time}`);
    console.log(`Tool used: ${result.selected_tool}`);
  }

  console.log("\nUser: \"Yes\"");
  const result1 = await orchestrateTurn(callSid1, "Yes", hospitalId, callerPhone);
  console.log(`AI Tool: ${result1.selected_tool}, Result Status: ${result1.result?.status}`);

  await delay(1000); // give WS a moment to receive broadcast

  // Verify DB
  const bookings = await prisma.appointment.findMany({
    where: { 
      patient: { name: 'Vinay' },
      doctorId: doctor.id,
    }
  });
  console.log(`Found ${bookings.length} bookings for Vinay in DB. First Status: ${bookings[0]?.status}`);

  const callLogs = await prisma.callLog.findMany({
    where: {
      twilioCallSid: callSid1
    }
  });
  console.log(`Found ${callLogs.length} call logs for this session. First callStatus: ${callLogs[0]?.callStatus}`);
  if (bookings.length > 0) {
    console.log(`Status: ${bookings[0].status}, Date: ${bookings[0].dateTime.toISOString()}`);
  }

  // Verify Dashboard WS
  const refreshEvents = messages.filter(m => m.type === 'REFRESH_DASHBOARD' || m.event === 'REFRESH_DASHBOARD');
  console.log(`Received ${refreshEvents.length} REFRESH_DASHBOARD events during Scenario 1.`);
  
  // --- Scenario 2: NO ---
  const callSid2 = 'e2e-test-2';
  clearSessionState(callSid2);
  messages.length = 0; // clear msg log

  console.log("\n--- Scenario 2: Cancel Appointment (NO) ---");
  const utterances2 = [
    "I want to book an appointment.",
    "Vinay",
    "810-555-8817",
    "Dr. Robert Smith",
    "July 7, 2026",
    "2:00 PM"
  ];

  for (const utterance of utterances2) {
    await orchestrateTurn(callSid2, utterance, hospitalId, callerPhone);
  }

  console.log("\nUser: \"No\"");
  const result2 = await orchestrateTurn(callSid2, "No", hospitalId, callerPhone);
  console.log(`AI Tool: ${result2.selected_tool}, Result Status: ${result2.result?.status}`);

  await delay(1000);
  const refreshEvents2 = messages.filter(m => m.type === 'REFRESH_DASHBOARD' || m.event === 'REFRESH_DASHBOARD');
  console.log(`Received ${refreshEvents2.length} REFRESH_DASHBOARD events during Scenario 2.`);

  dashboardWs.close();
  prisma.$disconnect();
}

runE2E().catch(err => {
  console.error("E2E Test Failed:", err);
  prisma.$disconnect();
});
