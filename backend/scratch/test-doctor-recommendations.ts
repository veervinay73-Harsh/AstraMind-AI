import dotenv from 'dotenv';
import { clearSessionState } from '../src/services/stateManager';
import { generateVoiceResponse } from '../src/services/responseGenerator';
import { orchestrateTurn } from '../src/services/orchestrator';

dotenv.config();

async function runDoctorRecommendationTests() {
  console.log("🚀 Starting Doctor Recommendation and Handoff Flow Verification Tests...\n");
  const callSid = "test_doctor_rec_session_999";
  const callerPhone = "+15557778888";
  const hospitalId = "seed-hospital-001";

  // Scenario 1: User asks for an inactive doctor (Dr. Lisa Park), gets recommendations, and selects one.
  const turns = [
    { text: "My name is John Doe." },
    { text: "My phone number is +15559990000" },
    // 1. Asks for Dr. Lisa Park (who is inactive/non-existent)
    { text: "I want to book an appointment with Dr. Lisa Park." },
    // 2. Patient accepts the recommendation offer by saying "yes" or asking for options
    { text: "Yes, please recommend a doctor." },
    // 3. Patient selects one of the recommended active doctors (e.g., Dr. Sarah Johnson)
    { text: "Let's book with Dr. Sarah Johnson." },
    // 4. Continue booking flow - provide date
    { text: "Tomorrow." },
    // 5. Provide time
    { text: "10 AM." }
  ];

  for (const [idx, turn] of turns.entries()) {
    console.log(`\n==================================================`);
    console.log(`📞 [TURN ${idx + 1}] Patient says: "${turn.text}"`);
    console.log(`==================================================`);

    const orchestratorResult = await orchestrateTurn(callSid, turn.text, hospitalId, callerPhone);
    const state = orchestratorResult.result;
    
    console.log(`⚙️ State fields:`);
    console.log(`   - Intent:            ${state.intent}`);
    console.log(`   - State:             ${state.state}`);
    console.log(`   - Doctor Slot:       ${state.doctor}`);
    console.log(`   - Invalid Doctor:    ${state.invalid_doctor}`);
    console.log(`   - Recommended:       ${JSON.stringify(state.recommended_doctors)}`);
    console.log(`   - Missing Fields:    ${JSON.stringify(state.missing_fields)}`);

    const voiceResponse = await generateVoiceResponse(turn.text, state, orchestratorResult);
    console.log(`🗣️ [AI Voice Response]: "${voiceResponse}"`);
  }

  clearSessionState(callSid);

  // Scenario 2: User asks for a specialization (Cardiologist) directly
  console.log(`\n\n==================================================`);
  console.log(`Scenario 2: Specifying a specialization ("Cardiologist")`);
  console.log(`==================================================`);
  
  // Turn 1: Patient asks for Cardiologist
  const turn1 = "I need a Cardiologist.";
  const orchRes = await orchestrateTurn(callSid, turn1, hospitalId, callerPhone);
  const state2 = orchRes.result;
  
  console.log(`⚙️ State fields:`);
  console.log(`   - Doctor Slot:       ${state2.doctor}`);
  console.log(`   - Invalid Doctor:    ${state2.invalid_doctor}`);
  console.log(`   - Recommended:       ${JSON.stringify(state2.recommended_doctors)}`);
  console.log(`   - Missing Fields:    ${JSON.stringify(state2.missing_fields)}`);

  const response2 = await generateVoiceResponse(turn1, state2, orchRes);
  console.log(`🗣️ [AI Voice Response]: "${response2}"`);

  clearSessionState(callSid);
  console.log("\nVerification complete.");
}

runDoctorRecommendationTests();
