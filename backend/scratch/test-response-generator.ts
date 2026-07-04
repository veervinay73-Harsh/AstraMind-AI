import dotenv from 'dotenv';
import { generateVoiceResponse } from '../src/services/responseGenerator';
import { BookingState } from '../src/services/stateManager';
import { OrchestratorResult } from '../src/services/orchestrator';

dotenv.config();

async function runResponseGeneratorTest() {
  console.log("🤖 Starting AI Response Generation Engine Verification Test...\n");

  const runTestScenario = async (
    title: string,
    utterance: string,
    state: BookingState,
    orchestratorResult: OrchestratorResult
  ) => {
    console.log(`--------------------------------------------------`);
    console.log(`🧪 Scenario: ${title}`);
    console.log(`--------------------------------------------------`);
    console.log(`Utterance: "${utterance}"`);
    console.log(`Tool: "${orchestratorResult.selected_tool}"`);
    console.log(`Outcome: ${JSON.stringify(orchestratorResult.result)}`);
    
    const response = await generateVoiceResponse(utterance, state, orchestratorResult);
    
    console.log(`\nGenerated Speakable Response:`);
    console.log(`👉 "${response}"`);
    console.log(`Length: ${response.length} characters`);
    console.log(`--------------------------------------------------\n`);
  };

  try {
    // 1. Booking Success
    await runTestScenario(
      "Booking Success",
      "Yes, please book it.",
      {
        intent: "BOOK_APPOINTMENT",
        state: "CONFIRMED",
        patient_name: "John Doe",
        doctor: "Dr. Robert Smith",
        date: "2026-07-04",
        time: "9:00 AM",
        phone: "+15557778888",
        missing_fields: []
      },
      {
        selected_tool: "BOOK_APPOINTMENT",
        reason: "User confirmed the details.",
        result: {
          status: "BOOKED",
          appointmentId: "mock-appt-123",
          doctor: "Dr. Robert Smith",
          department: "Cardiology",
          date: "2026-07-04",
          time: "9:00 AM"
        }
      }
    );

    // 2. Booking Failure (Slot Occupied)
    await runTestScenario(
      "Booking Failure (Slot Occupied)",
      "Yes, let's book it.",
      {
        intent: "BOOK_APPOINTMENT",
        state: "CONFIRMED",
        patient_name: "John Doe",
        doctor: "Dr. Robert Smith",
        date: "2026-07-04",
        time: "10:30 AM",
        phone: "+15557778888",
        missing_fields: []
      },
      {
        selected_tool: "BOOK_APPOINTMENT",
        reason: "User confirmed, but slot validation failed.",
        result: {
          status: "FAILED_SLOT_OCCUPIED",
          message: "Requested slot 10:30 AM is already booked."
        }
      }
    );

    // 3. Missing Information
    await runTestScenario(
      "Missing Information",
      "I want to book an appointment with Dr. Smith.",
      {
        intent: "BOOK_APPOINTMENT",
        state: "COLLECTING_INFORMATION",
        patient_name: null,
        doctor: "Dr. Smith",
        date: "2026-07-04",
        time: null,
        phone: "+15557778888",
        missing_fields: ["patient_name", "time"]
      },
      {
        selected_tool: "NONE",
        reason: "Awaiting missing details.",
        result: {
          intent: "BOOK_APPOINTMENT",
          state: "COLLECTING_INFORMATION",
          missing_fields: ["patient_name", "time"]
        }
      }
    );

    // 4. FAQ Answering
    await runTestScenario(
      "FAQ Response Match",
      "What are the hospital timings?",
      {
        intent: "ASK_HOSPITAL_INFORMATION",
        state: "OTHER",
        missing_fields: []
      },
      {
        selected_tool: "HOSPITAL_FAQ",
        reason: "User asked timings question.",
        result: {
          status: "ANSWER_FOUND",
          question: "What are the hospital timings?",
          answer: "AstraMind Orchestrator Hospital is open from 9 AM to 5 PM.",
          confidence: 0.95
        }
      }
    );

    // 5. Cancellation Success
    await runTestScenario(
      "Cancellation Success",
      "Please cancel my appointment.",
      {
        intent: "CANCEL_APPOINTMENT",
        state: "OTHER",
        missing_fields: []
      },
      {
        selected_tool: "CANCEL_APPOINTMENT",
        reason: "User requested cancellation.",
        result: {
          status: "CANCELLED",
          appointmentId: "mock-appt-123",
          doctor: "Dr. Robert Smith",
          date: "2026-07-04",
          time: "10:00 AM"
        }
      }
    );

    // 6. Rescheduling Success
    await runTestScenario(
      "Rescheduling Success",
      "Reschedule my appointment to July 5th at 11:30 AM.",
      {
        intent: "RESCHEDULE_APPOINTMENT",
        state: "OTHER",
        missing_fields: []
      },
      {
        selected_tool: "RESCHEDULE_APPOINTMENT",
        reason: "User requested reschedule.",
        result: {
          status: "RESCHEDULED",
          appointmentId: "mock-appt-123",
          doctor: "Dr. Robert Smith",
          old_date: "2026-07-04",
          old_time: "10:00 AM",
          new_date: "2026-07-05",
          new_time: "11:30 AM"
        }
      }
    );

    // 7. Human Handoff
    await runTestScenario(
      "Human Handoff Request",
      "I want to speak with a human receptionist.",
      {
        intent: "TALK_TO_HUMAN",
        state: "OTHER",
        missing_fields: []
      },
      {
        selected_tool: "HUMAN_HANDOFF",
        reason: "User explicitly requested human handoff.",
        result: {
          status: "HANDOVER_INITIATED",
          phone: "+15557778888"
        }
      }
    );

    // 8. Unknown Intent
    await runTestScenario(
      "Unknown / Out-of-Domain Intent",
      "I want to order a pepperoni pizza.",
      {
        intent: "UNKNOWN",
        state: "OTHER",
        missing_fields: []
      },
      {
        selected_tool: "NONE",
        reason: "No tools match pizza request.",
        result: {
          status: "UNKNOWN_INTENT",
          transcript: "I want to order a pepperoni pizza."
        }
      }
    );

  } catch (error) {
    console.error("❌ Test crashed with error:", error);
  } finally {
    process.exit(0);
  }
}

runResponseGeneratorTest();
