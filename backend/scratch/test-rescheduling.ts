import dotenv from 'dotenv';
import prisma from '../src/config/prisma';
import { rescheduleAppointment } from '../src/services/rescheduling';

dotenv.config();

async function runReschedulingTest() {
  console.log("🤖 Starting Appointment Rescheduling Engine Verification Test...\n");

  let mockHospital: any = null;
  let mockDoctor: any = null;
  let mockPatient1: any = null;
  let mockPatient2: any = null;
  let mockAppt1: any = null;
  let mockAppt2: any = null;

  try {
    // 1. Setup mock data
    console.log("📦 Provisioning temporary test data in database...");
    
    mockHospital = await prisma.hospital.create({
      data: {
        name: "AstraMind Reschedule Test Hospital",
        address: "101 Reschedule Blvd",
        phone: "+15551110000",
      }
    });

    mockDoctor = await prisma.doctor.create({
      data: {
        name: "Dr. Robert Smith",
        specialization: "Cardiology",
        email: "robert.smith@reschedtest.com",
        phone: "+15552223333",
        hospitalId: mockHospital.id,
      }
    });

    mockPatient1 = await prisma.patient.create({
      data: {
        name: "John Doe",
        phone: "+15557778888",
        email: "john.doe@reschedtest.com",
        hospitalId: mockHospital.id,
      }
    });

    mockPatient2 = await prisma.patient.create({
      data: {
        name: "Jane Smith",
        phone: "+15554443333",
        email: "jane.smith@reschedtest.com",
        hospitalId: mockHospital.id,
      }
    });

    // Patient 1 has an existing appointment on 2026-07-04 at 10:00 AM
    mockAppt1 = await prisma.appointment.create({
      data: {
        patientId: mockPatient1.id,
        doctorId: mockDoctor.id,
        dateTime: new Date(Date.UTC(2026, 6, 4, 10, 0, 0)), // 2026-07-04T10:00:00Z
        duration: 30,
        hospitalId: mockHospital.id,
      }
    });

    console.log("✅ Temporary test data successfully provisioned.");

    // --- Scenario 1: Successful Reschedule ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 1: Successful Reschedule");
    console.log("--------------------------------------------------");
    const resultSuccess = await rescheduleAppointment(
      "+15557778888",
      mockHospital.id,
      "2026-07-05",
      "11:30 AM"
    );
    console.log("Result:", JSON.stringify(resultSuccess, null, 2));

    if (resultSuccess.status === "RESCHEDULED" && resultSuccess.new_date === "2026-07-05" && resultSuccess.new_time === "11:30 AM") {
      console.log("Scenario 1 Status: ✅ PASS");
    } else {
      console.log("Scenario 1 Status: ❌ FAIL");
    }

    // --- Scenario 2: Requested Slot Occupied ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 2: Requested Slot Occupied");
    console.log("--------------------------------------------------");
    // Create an occupying appointment for Patient 2 on 2026-07-05 at 2:00 PM
    mockAppt2 = await prisma.appointment.create({
      data: {
        patientId: mockPatient2.id,
        doctorId: mockDoctor.id,
        dateTime: new Date(Date.UTC(2026, 6, 5, 14, 0, 0)), // 2026-07-05T14:00:00Z
        duration: 30,
        hospitalId: mockHospital.id,
      }
    });

    // Try to reschedule Patient 1's appointment to the occupied slot (2026-07-05 at 2:00 PM)
    const resultOccupied = await rescheduleAppointment(
      "+15557778888",
      mockHospital.id,
      "2026-07-05",
      "2:00 PM"
    );
    console.log("Result:", JSON.stringify(resultOccupied, null, 2));

    if (resultOccupied.status === "FAILED_SLOT_OCCUPIED") {
      console.log("Scenario 2 Status: ✅ PASS");
    } else {
      console.log("Scenario 2 Status: ❌ FAIL");
    }

    // --- Scenario 3: Invalid Doctor query / Not Found ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 3: Invalid Doctor filter query");
    console.log("--------------------------------------------------");
    const resultInvalidDoc = await rescheduleAppointment(
      "+15557778888",
      mockHospital.id,
      "2026-07-05",
      "3:00 PM",
      "Neurosurgeon"
    );
    console.log("Result:", JSON.stringify(resultInvalidDoc, null, 2));

    if (resultInvalidDoc.status === "FAILED_NOT_FOUND") {
      console.log("Scenario 3 Status: ✅ PASS");
    } else {
      console.log("Scenario 3 Status: ❌ FAIL");
    }

    // --- Scenario 4: Appointment Not Found ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 4: Appointment Not Found");
    console.log("--------------------------------------------------");

    // Wait, Patient 2 has mockAppt2, so let's delete it first to test no appointment condition:
    await prisma.appointment.delete({ where: { id: mockAppt2.id } });
    mockAppt2 = null;
    
    const resultNoApptActual = await rescheduleAppointment(
      "+15554443333",
      mockHospital.id,
      "2026-07-05",
      "4:00 PM"
    );
    console.log("Result:", JSON.stringify(resultNoApptActual, null, 2));

    if (resultNoApptActual.status === "FAILED_NOT_FOUND") {
      console.log("Scenario 4 Status: ✅ PASS");
    } else {
      console.log("Scenario 4 Status: ❌ FAIL");
    }

    // --- Scenario 5: Invalid Patient ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 5: Invalid Patient");
    console.log("--------------------------------------------------");
    const resultInvalidPatient = await rescheduleAppointment(
      "+15550000000",
      mockHospital.id,
      "2026-07-05",
      "4:00 PM"
    );
    console.log("Result:", JSON.stringify(resultInvalidPatient, null, 2));

    if (resultInvalidPatient.status === "FAILED_INVALID_PATIENT") {
      console.log("Scenario 5 Status: ✅ PASS");
    } else {
      console.log("Scenario 5 Status: ❌ FAIL");
    }

    // --- Scenario 6: Missing Required Fields ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 6: Missing Required Fields");
    console.log("--------------------------------------------------");
    const resultMissing = await rescheduleAppointment(
      "+15557778888",
      mockHospital.id,
      null, // missing date
      "4:00 PM"
    );
    console.log("Result:", JSON.stringify(resultMissing, null, 2));

    if (resultMissing.status === "FAILED_MISSING_FIELDS") {
      console.log("Scenario 6 Status: ✅ PASS");
    } else {
      console.log("Scenario 6 Status: ❌ FAIL");
    }

  } catch (error) {
    console.error("❌ Test script crashed with error:", error);
  } finally {
    // 2. Clean up mock database records
    console.log("\n🧹 Cleaning up temporary test data from database...");
    
    if (mockAppt1) await prisma.appointment.delete({ where: { id: mockAppt1.id } }).catch(() => {});
    if (mockAppt2) await prisma.appointment.delete({ where: { id: mockAppt2.id } }).catch(() => {});
    
    if (mockDoctor) {
      await prisma.doctor.delete({ where: { id: mockDoctor.id } }).catch(() => {});
    }

    if (mockHospital) {
      await prisma.patient.deleteMany({ where: { hospitalId: mockHospital.id } }).catch(() => {});
      await prisma.hospital.delete({ where: { id: mockHospital.id } }).catch(() => {});
    }

    console.log("🧹 Cleanup complete.");
    process.exit(0);
  }
}

runReschedulingTest();
