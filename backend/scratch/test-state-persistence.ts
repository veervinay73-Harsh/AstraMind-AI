import dotenv from 'dotenv';
import { clearSessionState, getSessionState } from '../src/services/stateManager';
import { generateVoiceResponse } from '../src/services/responseGenerator';
import { orchestrateTurn } from '../src/services/orchestrator';

dotenv.config();

async function runStatePersistenceTests() {
  console.log("🚀 Starting Slot-Filling State Persistence Verification Tests...\n");
  const callSid = "test_persistence_session_999";
  const callerPhone = "+15557778888";
  const hospitalId = "seed-hospital-001";

  const turns = [
    // 1. Patient provides name
    { text: "My name is Vinay." },
    // 2. Patient provides doctor (unrelated query next to check if name is retained)
    { text: "I want to see Dr. Robert Smith." },
    // 3. Low confidence / unrelated comment (e.g. "What color is the sky?") - check if Vinay & Dr. Smith are still set
    { text: "What color is the sky?" },
    // 4. Provide date
    { text: "Book it for tomorrow." },
    // 5. Provide time
    { text: "At 10 o'clock in the morning." }
  ];

  for (const [idx, turn] of turns.entries()) {
    console.log(`\n==================================================`);
    console.log(`📞 [TURN ${idx + 1}] Patient says: "${turn.text}"`);
    console.log(`==================================================`);

    const orchestratorResult = await orchestrateTurn(callSid, turn.text, hospitalId, callerPhone);
    const state = getSessionState(callSid);

    console.log(`⚙️ State fields in StateManager:`);
    console.log(`   - Session ID:        ${callSid}`);
    console.log(`   - Patient Name:      ${state.patient_name}`);
    console.log(`   - Phone:             ${state.phone}`);
    console.log(`   - Doctor Slot:       ${state.doctor}`);
    console.log(`   - Date:              ${state.date}`);
    console.log(`   - Time:              ${state.time}`);
    console.log(`   - Missing Fields:    ${JSON.stringify(state.missing_fields)}`);

    const voiceResponse = await generateVoiceResponse(turn.text, state, orchestratorResult, callSid);
    console.log(`🗣️ [AI Voice Response]: "${voiceResponse}"`);
  }

  clearSessionState(callSid);
  console.log("\nVerification complete.");
}

runStatePersistenceTests();
