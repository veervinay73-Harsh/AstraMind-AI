import dotenv from 'dotenv';
import prisma from '../src/config/prisma';
import { orchestrateTurn } from '../src/services/orchestrator';

dotenv.config();

async function runOrchestratorTest() {
  console.log("🤖 Starting AI Orchestrator & Tool Router Verification Test...\n");

  let mockHospital: any = null;
  let mockDoctor: any = null;
  let mockPatient: any = null;

  try {
    // 1. Setup mock data
    console.log("📦 Provisioning temporary multi-tenant orchestrator data in database...");
    
    mockHospital = await prisma.hospital.create({
      data: {
        name: "AstraMind Orchestrator Hospital",
        address: "505 Router Way",
        phone: "+15550002222",
      }
    });

    mockDoctor = await prisma.doctor.create({
      data: {
        name: "Dr. Robert Smith",
        specialization: "Cardiology",
        email: "robert.smith@orchestratortest.com",
        phone: "+15551112222",
        hospitalId: mockHospital.id,
      }
    });

    mockPatient = await prisma.patient.create({
      data: {
        name: "John Doe",
        phone: "+15557778888",
        email: "john.doe@orchestratortest.com",
        hospitalId: mockHospital.id,
      }
    });

    // Create an initial appointment on July 4th at 10:00 AM (needed for reschedule/cancel tests)
    await prisma.appointment.create({
      data: {
        patientId: mockPatient.id,
        doctorId: mockDoctor.id,
        dateTime: new Date(Date.UTC(2026, 6, 4, 10, 0, 0)), // 2026-07-04T10:00:00Z
        duration: 30,
        hospitalId: mockHospital.id,
      }
    });

    // Create FAQ article
    await prisma.knowledgeBaseArticle.create({
      data: {
        category: "Timings",
        question: "What are the hospital timings?",
        answer: "AstraMind Orchestrator Hospital is open from 9 AM to 5 PM.",
        hospitalId: mockHospital.id,
      }
    });

    console.log("✅ Database test data provisioned successfully.");

    // --- Scenario 1: Booking Workflow (Collecting details) ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Scenario 1a: Booking Workflow - Collecting details");
    console.log("--------------------------------------------------");
    const callSidBook = "call_sid_booking_123";
    const resultBookCollect = await orchestrateTurn(
      callSidBook,
      "I want to book an appointment with Dr. Robert Smith on July 4th at 9:00 AM.",
      mockHospital.id,
      "+15557778888"
    );
    console.log("Result:", JSON.stringify(resultBookCollect, null, 2));
    if (resultBookCollect.selected_tool === "NONE" && resultBookCollect.result.missing_fields.includes("patient_name")) {
      console.log("Scenario 1a Status: ✅ PASS");
    } else {
      console.log("Scenario 1a Status: ❌ FAIL");
    }

    // --- Scenario 1b: Booking Workflow - Provide remaining details ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Scenario 1b: Booking Workflow - Provide remaining details");
    console.log("--------------------------------------------------");
    const resultBookProvide = await orchestrateTurn(
      callSidBook,
      "My name is John Doe.",
      mockHospital.id,
      "+15557778888"
    );
    console.log("Result:", JSON.stringify(resultBookProvide, null, 2));
    const isConfirmationRequired = resultBookProvide.selected_tool === "NONE" && resultBookProvide.result.state === "CONFIRMATION_REQUIRED";
    if (isConfirmationRequired) {
      console.log("Scenario 1b Status: ✅ PASS");
    } else {
      console.log("Scenario 1b Status: ❌ FAIL");
    }

    // --- Scenario 1c: Booking Workflow - Confirmed details ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Scenario 1c: Booking Workflow - Confirmed details");
    console.log("--------------------------------------------------");
    const resultBookConfirm = await orchestrateTurn(
      callSidBook,
      "Yes, please confirm the booking. That sounds perfect.",
      mockHospital.id,
      "+15557778888"
    );
    console.log("Result:", JSON.stringify(resultBookConfirm, null, 2));
    if (resultBookConfirm.selected_tool === "BOOK_APPOINTMENT" && resultBookConfirm.result.status === "BOOKED") {
      console.log("Scenario 1c Status: ✅ PASS");
    } else {
      console.log("Scenario 1c Status: ❌ FAIL");
    }

    // --- Scenario 2: Rescheduling Workflow ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Scenario 2: Rescheduling Workflow");
    console.log("--------------------------------------------------");
    const callSidReschedule = "call_sid_reschedule_123";
    const resultReschedule = await orchestrateTurn(
      callSidReschedule,
      "I need to reschedule my appointment with Dr. Robert Smith to July 5th at 11:30 AM.",
      mockHospital.id,
      "+15557778888"
    );
    console.log("Result:", JSON.stringify(resultReschedule, null, 2));
    if (resultReschedule.selected_tool === "RESCHEDULE_APPOINTMENT" && resultReschedule.result.status === "RESCHEDULED") {
      console.log("Scenario 2 Status: ✅ PASS");
    } else {
      console.log("Scenario 2 Status: ❌ FAIL");
    }

    // --- Scenario 3: FAQ Workflow ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Scenario 3: FAQ Workflow");
    console.log("--------------------------------------------------");
    const callSidFAQ = "call_sid_faq_123";
    const resultFAQ = await orchestrateTurn(
      callSidFAQ,
      "What are your opening hours?",
      mockHospital.id,
      "+15557778888"
    );
    console.log("Result:", JSON.stringify(resultFAQ, null, 2));
    if (resultFAQ.selected_tool === "HOSPITAL_FAQ" && resultFAQ.result.status === "ANSWER_FOUND") {
      console.log("Scenario 3 Status: ✅ PASS");
    } else {
      console.log("Scenario 3 Status: ❌ FAIL");
    }

    // --- Scenario 4: Human Handoff ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Scenario 4: Human Handoff");
    console.log("--------------------------------------------------");
    const callSidHandoff = "call_sid_handoff_123";
    const resultHandoff = await orchestrateTurn(
      callSidHandoff,
      "I want to speak to a receptionist now.",
      mockHospital.id,
      "+15557778888"
    );
    console.log("Result:", JSON.stringify(resultHandoff, null, 2));
    if (resultHandoff.selected_tool === "HUMAN_HANDOFF" && resultHandoff.result.status === "HANDOVER_INITIATED") {
      console.log("Scenario 4 Status: ✅ PASS");
    } else {
      console.log("Scenario 4 Status: ❌ FAIL");
    }

    // --- Scenario 5: Cancellation Workflow ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Scenario 5: Cancellation Workflow");
    console.log("--------------------------------------------------");
    const callSidCancel = "call_sid_cancel_123";
    const resultCancel = await orchestrateTurn(
      callSidCancel,
      "Please cancel my appointment.",
      mockHospital.id,
      "+15557778888"
    );
    console.log("Result:", JSON.stringify(resultCancel, null, 2));
    if (resultCancel.selected_tool === "CANCEL_APPOINTMENT" && resultCancel.result.status === "CANCELLED") {
      console.log("Scenario 5 Status: ✅ PASS");
    } else {
      console.log("Scenario 5 Status: ❌ FAIL");
    }

    // --- Scenario 6: Unknown Intent ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Scenario 6: Unknown Intent");
    console.log("--------------------------------------------------");
    const callSidUnknown = "call_sid_unknown_123";
    const resultUnknown = await orchestrateTurn(
      callSidUnknown,
      "Can I order a pepperoni pizza with extra cheese?",
      mockHospital.id,
      "+15557778888"
    );
    console.log("Result:", JSON.stringify(resultUnknown, null, 2));
    if (resultUnknown.selected_tool === "NONE" && resultUnknown.result.status === "UNKNOWN_INTENT") {
      console.log("Scenario 6 Status: ✅ PASS");
    } else {
      console.log("Scenario 6 Status: ❌ FAIL");
    }

  } catch (error) {
    console.error("❌ Test script crashed with error:", error);
  } finally {
    // 2. Clean up mock database records
    console.log("\n🧹 Cleaning up temporary test data from database...");
    
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

runOrchestratorTest();
