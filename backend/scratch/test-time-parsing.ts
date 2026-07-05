import dotenv from 'dotenv';
import { processConversationTurn, clearSessionState, getSessionState } from '../src/services/stateManager';

dotenv.config();

async function runTimeParsingTests() {
  console.log("🚀 Starting Slot-Filling Time Parser Verification Tests...\n");
  const callSid = "test_time_parsing_session_999";
  const callerPhone = "+15557778888";

  const testUtterances = [
    { text: "My name is John Doe.", expectedField: "patient_name" },
    { text: "My mobile number is +1234567890", expectedField: "phone" },
    { text: "I want Dr. Robert Smith in Cardiology.", expectedField: "doctor" },
    { text: "I would prefer tomorrow.", expectedField: "date" },
    // Time tests:
    { text: "5 PM", expectedField: "time" },
    { text: "It's 5 PM in the evening", expectedField: "time" },
    { text: "Around 5 o'clock", expectedField: "time" },
    { text: "Tomorrow at 10 AM", expectedField: "time" },
    { text: "Half past 3", expectedField: "time" }
  ];

  for (const [idx, item] of testUtterances.entries()) {
    // If it's a time test, reset the time slot so we test fresh extraction
    if (item.expectedField === "time") {
      const state = getSessionState(callSid);
      state.time = null;
    }
    
    console.log(`--------------------------------------------------`);
    console.log(`[TEST ${idx + 1}] Patient says: "${item.text}"`);
    console.log(`--------------------------------------------------`);

    const updatedState = await processConversationTurn(callSid, item.text, callerPhone);
    console.log(`🔍 Extracted Slots:`);
    console.log(`   - Patient Name: ${updatedState.patient_name}`);
    console.log(`   - Phone:        ${updatedState.phone}`);
    console.log(`   - Doctor/Spec:  ${updatedState.doctor}`);
    console.log(`   - Date:         ${updatedState.date}`);
    console.log(`   - Time:         ${updatedState.time}`);
    console.log(`   - Missing:      ${JSON.stringify(updatedState.missing_fields)}`);
    
    if (updatedState[item.expectedField as keyof typeof updatedState]) {
      console.log(`✅ Success: Slot "${item.expectedField}" filled successfully with value: "${updatedState[item.expectedField as keyof typeof updatedState]}"`);
    } else {
      console.log(`❌ Failed: Slot "${item.expectedField}" is still empty!`);
    }
  }

  clearSessionState(callSid);
  console.log("\nVerification complete.");
}

runTimeParsingTests();
