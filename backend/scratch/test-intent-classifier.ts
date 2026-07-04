import dotenv from 'dotenv';
import { classifyIntent } from '../src/services/intentClassifier';

// Load environment variables
dotenv.config();

const testCases = [
  {
    sentence: "I want to book an appointment with a cardiologist tomorrow.",
    expectedIntent: "BOOK_APPOINTMENT"
  },
  {
    sentence: "Can you schedule a checkup for me next Tuesday morning?",
    expectedIntent: "BOOK_APPOINTMENT"
  },
  {
    sentence: "I need to cancel my appointment for tomorrow afternoon.",
    expectedIntent: "CANCEL_APPOINTMENT"
  },
  {
    sentence: "Please reschedule my meeting with Dr. Smith from Wednesday to Thursday at 2 PM.",
    expectedIntent: "RESCHEDULE_APPOINTMENT"
  },
  {
    sentence: "What is the hospital's phone number and office address?",
    expectedIntent: "ASK_HOSPITAL_INFORMATION"
  },
  {
    sentence: "Are you guys open on Sundays?",
    expectedIntent: "ASK_HOSPITAL_INFORMATION"
  },
  {
    sentence: "Can I talk to a human receptionist? The AI is not understanding me.",
    expectedIntent: "TALK_TO_HUMAN"
  },
  {
    sentence: "Put me through to the front desk staff please.",
    expectedIntent: "TALK_TO_HUMAN"
  },
  {
    sentence: "I want to buy some pizza and watch a movie tonight.",
    expectedIntent: "UNKNOWN"
  }
];

async function runClassifierTest() {
  console.log("🤖 Starting Groq Intent Classifier Verification Test...\n");
  console.log("--------------------------------------------------------------------------------");
  console.log("| Sentence                                | Expected Intent          | Detected Intent          | Conf. | Status |");
  console.log("--------------------------------------------------------------------------------");

  let passedCount = 0;

  for (const test of testCases) {
    const start = Date.now();
    const result = await classifyIntent(test.sentence);
    const latency = Date.now() - start;

    const isMatch = result.intent === test.expectedIntent;
    if (isMatch) passedCount++;

    const sentenceCol = test.sentence.length > 38 ? test.sentence.substring(0, 35) + "..." : test.sentence.padEnd(38);
    const expectedCol = test.expectedIntent.padEnd(24);
    const detectedCol = result.intent.padEnd(24);
    const confidenceCol = (result.confidence.toFixed(2)).padEnd(5);
    const statusCol = isMatch ? "✅ PASS" : "❌ FAIL";

    console.log(`| ${sentenceCol} | ${expectedCol} | ${detectedCol} | ${confidenceCol} | ${statusCol} (${latency}ms) |`);
  }

  console.log("--------------------------------------------------------------------------------");
  console.log(`\n📊 Verification Summary: ${passedCount}/${testCases.length} Test Cases Passed (${((passedCount / testCases.length) * 100).toFixed(1)}%)`);
}

runClassifierTest().catch(err => {
  console.error("Test failed with error:", err);
});
