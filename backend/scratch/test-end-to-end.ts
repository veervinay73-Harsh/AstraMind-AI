import dotenv from 'dotenv';
import prisma from '../src/config/prisma';
import { orchestrateTurn } from '../src/services/orchestrator';
import { generateVoiceResponse } from '../src/services/responseGenerator';
import { getSessionState, clearSessionState } from '../src/services/stateManager';

dotenv.config();

async function runEndToEndCallSimulation() {
  console.log("🚀 Starting End-to-End Live Call Pipeline Simulation...\n");

  let mockHospital: any = null;

  try {
    // 1. Setup mock data
    console.log("📦 Provisioning multi-tenant database records...");
    
    mockHospital = await prisma.hospital.create({
      data: {
        name: "AstraMind Integrated Medical Center",
        address: "700 Pipeline Avenue",
        phone: "+15558880000",
      }
    });

    await prisma.doctor.create({
      data: {
        name: "Dr. Robert Smith",
        specialization: "Cardiology",
        email: "robert.smith@integrated.com",
        phone: "+15558881111",
        hospitalId: mockHospital.id,
      }
    });

    // Create Patient profile (so cancel/reschedule find it)
    await prisma.patient.create({
      data: {
        name: "John Doe",
        phone: "+15557778888",
        email: "john.doe@integrated.com",
        hospitalId: mockHospital.id,
      }
    });

    // Create FAQ article
    await prisma.knowledgeBaseArticle.create({
      data: {
        category: "Timings",
        question: "What are the hospital timings?",
        answer: "AstraMind Integrated Medical Center is open from 8:00 AM to 8:00 PM.",
        hospitalId: mockHospital.id,
      }
    });

    console.log("✅ Database provisioned. Starting call session...\n");

    const callSid = "live_call_session_sid_end_to_end_999";
    const callerPhone = "+15557778888";

    // Helper to simulate a single dialogue turn through the pipeline
    const simulateTurn = async (turnIndex: number, utterance: string) => {
      console.log(`==================================================`);
      console.log(`📞 [TURN ${turnIndex}] Patient says: "${utterance}"`);
      console.log(`==================================================`);

      // Pipeline Stage 1: AI Orchestrator & Tool Router (takes care of State Manager & Tool execution)
      const orchestratorResult = await orchestrateTurn(callSid, utterance, mockHospital.id, callerPhone);
      console.log(`⚙️ [Orchestrator] Selected Tool: ${orchestratorResult.selected_tool}`);
      console.log(`⚙️ [Orchestrator] Reason: ${orchestratorResult.reason}`);
      console.log(`⚙️ [Orchestrator] Result Status: ${orchestratorResult.result.status || orchestratorResult.result.state || "N/A"}`);

      // Pipeline Stage 2: AI Response Generator
      const sessionState = getSessionState(callSid);
      const speakableText = await generateVoiceResponse(utterance, sessionState, orchestratorResult);
      console.log(`🗣️ [AI Voice Response]: "${speakableText}"`);
      console.log(`--------------------------------------------------\n`);
    };

    // --- TURN 1: Book Appointment (Collecting details) ---
    await simulateTurn(
      1,
      "Hi, I want to book an appointment with Dr. Robert Smith on July 4th at 9:00 AM."
    );

    // --- TURN 2: Book Appointment (Provide remaining details) ---
    await simulateTurn(
      2,
      "My name is John Doe."
    );

    // --- TURN 3: Book Appointment (Confirm and execute DB write) ---
    await simulateTurn(
      3,
      "Yes, please confirm the booking. That sounds perfect."
    );

    // --- TURN 4: Reschedule Appointment ---
    await simulateTurn(
      4,
      "Actually, can you reschedule my appointment with Dr. Smith to July 5th at 11:30 AM?"
    );

    // --- TURN 5: FAQ Query ---
    await simulateTurn(
      5,
      "What time do you close?"
    );

    // --- TURN 6: Cancel Appointment ---
    await simulateTurn(
      6,
      "Please cancel the appointment."
    );

    // --- TURN 7: Human Handoff ---
    await simulateTurn(
      7,
      "Let me speak to a real receptionist."
    );

    // --- TURN 8: Call ends (Clean up session state) ---
    console.log("==================================================");
    console.log("📞 Call disconnected. Performing session cleanup...");
    console.log("==================================================");
    
    // Assert state exists before cleanup
    const stateBefore = getSessionState(callSid);
    console.log("Active slots state before cleanup exists:", !!stateBefore);

    clearSessionState(callSid);

    // Assert state does not exist after cleanup
    const stateAfter = getSessionState(callSid);
    // Since getSessionState auto-initializes empty, check if it's cleared/empty
    const isCleaned = stateAfter.intent === "UNKNOWN" && stateAfter.patient_name === null;
    console.log("Slots state cleared successfully:", isCleaned ? "✅ YES" : "❌ NO");
    console.log("==================================================\n");

  } catch (error) {
    console.error("❌ E2E Simulation crashed with error:", error);
  } finally {
    // Clean up mock database records
    console.log("🧹 Cleaning up temporary test data from database...");
    
    if (mockHospital) {
      await prisma.appointment.deleteMany({ where: { hospitalId: mockHospital.id } }).catch(() => {});
      await prisma.knowledgeBaseArticle.deleteMany({ where: { hospitalId: mockHospital.id } }).catch(() => {});
      await prisma.doctor.deleteMany({ where: { hospitalId: mockHospital.id } }).catch(() => {});
      await prisma.patient.deleteMany({ where: { hospitalId: mockHospital.id } }).catch(() => {});
      await prisma.hospital.delete({ where: { id: mockHospital.id } }).catch(() => {});
    }

    console.log("🧹 Cleanup complete.");
    process.exit(0);
  }
}

runEndToEndCallSimulation();
