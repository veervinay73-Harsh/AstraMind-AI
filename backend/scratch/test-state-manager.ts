import dotenv from 'dotenv';
import { processConversationTurn, clearSessionState } from '../src/services/stateManager';

dotenv.config();

interface Turn {
  utterance: string;
  expectedState: string;
}

interface Dialogue {
  name: string;
  callerPhone: string;
  turns: Turn[];
}

const testDialogues: Dialogue[] = [
  {
    name: "Dialogue 1: Incremental Booking Flow",
    callerPhone: "+15551234567",
    turns: [
      {
        utterance: "I want to book an appointment.",
        expectedState: "COLLECTING_INFORMATION"
      },
      {
        utterance: "I want to see a cardiologist tomorrow.",
        expectedState: "COLLECTING_INFORMATION"
      },
      {
        utterance: "Let's schedule it for 10 AM. My name is Alice.",
        expectedState: "CONFIRMATION_REQUIRED"
      },
      {
        utterance: "Yes, please confirm this appointment.",
        expectedState: "CONFIRMED"
      }
    ]
  },
  {
    name: "Dialogue 2: Single-Shot Details and Confirmation",
    callerPhone: "+15559876543",
    turns: [
      {
        utterance: "I need to schedule a dermatologist for tomorrow at 3 PM. My name is Bob.",
        expectedState: "CONFIRMATION_REQUIRED"
      },
      {
        utterance: "Yep, that sounds perfect. Go ahead and confirm.",
        expectedState: "CONFIRMED"
      }
    ]
  }
];

async function runDialogueTests() {
  console.log("🤖 Starting Conversation State Manager Verification Test...\n");

  for (const dialogue of testDialogues) {
    const callSid = `call_sid_${Math.floor(Math.random() * 100000)}`;
    console.log(`================================================================================`);
    console.log(`🎬 Running ${dialogue.name}`);
    console.log(`📞 Caller Phone: ${dialogue.callerPhone}`);
    console.log(`================================================================================`);

    for (let i = 0; i < dialogue.turns.length; i++) {
      const turn = dialogue.turns[i];
      console.log(`\n👉 Turn ${i + 1}: User says: "${turn.utterance}"`);

      const start = Date.now();
      const updatedState = await processConversationTurn(callSid, turn.utterance, dialogue.callerPhone);
      const latency = Date.now() - start;

      console.log(`🕒 Latency: ${latency}ms`);
      console.log(`✨ Current State:`);
      console.log(JSON.stringify({
        intent: updatedState.intent,
        state: updatedState.state,
        patient_name: updatedState.patient_name,
        doctor: updatedState.doctor,
        date: updatedState.date,
        time: updatedState.time,
        phone: updatedState.phone,
        missing_fields: updatedState.missing_fields
      }, null, 2));

      const isStatePass = updatedState.state === turn.expectedState;
      console.log(`Status: ${isStatePass ? "✅ PASS" : "❌ FAIL"} (Expected State: ${turn.expectedState})`);
    }

    // Clean up session state
    clearSessionState(callSid);
    console.log("\n");
  }
}

runDialogueTests().catch(err => {
  console.error("State Manager dialogue test execution failed:", err);
});
