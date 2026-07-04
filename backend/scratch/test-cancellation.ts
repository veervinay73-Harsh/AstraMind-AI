import dotenv from 'dotenv';
import prisma from '../src/config/prisma';
import { cancelAppointment } from '../src/services/cancellation';

dotenv.config();

async function runCancellationTest() {
  console.log("🤖 Starting Appointment Cancellation Engine Verification Test...\n");

  let mockHospital: any = null;
  let mockDoctor: any = null;
  let mockPatient1: any = null;
  let mockAppt: any = null;

  try {
    // 1. Setup mock data
    console.log("📦 Provisioning temporary test data in database...");
    
    mockHospital = await prisma.hospital.create({
      data: {
        name: "AstraMind Cancellation Test Hospital",
        address: "789 Clinic Drive",
        phone: "+15550009999",
      }
    });

    mockDoctor = await prisma.doctor.create({
      data: {
        name: "Dr. Robert Smith",
        specialization: "Cardiology",
        email: "robert.smith@canceltest.com",
        phone: "+15551112222",
        hospitalId: mockHospital.id,
      }
    });

    mockPatient1 = await prisma.patient.create({
      data: {
        name: "John Doe",
        phone: "+15557778888",
        email: "john.doe@canceltest.com",
        hospitalId: mockHospital.id,
      }
    });

    await prisma.patient.create({
      data: {
        name: "Jane Doe",
        phone: "+15554443333",
        email: "jane.doe@canceltest.com",
        hospitalId: mockHospital.id,
      }
    });

    // Create appointment for Patient 1
    mockAppt = await prisma.appointment.create({
      data: {
        patientId: mockPatient1.id,
        doctorId: mockDoctor.id,
        dateTime: new Date(Date.UTC(2026, 6, 4, 10, 0, 0)), // 2026-07-04T10:00:00Z
        duration: 30,
        hospitalId: mockHospital.id,
      }
    });

    console.log("✅ Temporary test data successfully provisioned.");

    // --- Scenario 1: Successful Cancellation ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 1: Successful Cancellation");
    console.log("--------------------------------------------------");
    const resultSuccess = await cancelAppointment("+15557778888", mockHospital.id);
    console.log("Result:", JSON.stringify(resultSuccess, null, 2));

    if (resultSuccess.status === "CANCELLED" && resultSuccess.appointmentId === mockAppt.id) {
      console.log("Scenario 1 Status: ✅ PASS");
    } else {
      console.log("Scenario 1 Status: ❌ FAIL");
    }

    // --- Scenario 2: Already Cancelled Appointment ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 2: Already Cancelled Appointment");
    console.log("--------------------------------------------------");
    const resultAlreadyCancelled = await cancelAppointment("+15557778888", mockHospital.id);
    console.log("Result:", JSON.stringify(resultAlreadyCancelled, null, 2));

    if (resultAlreadyCancelled.status === "FAILED_ALREADY_CANCELLED") {
      console.log("Scenario 2 Status: ✅ PASS");
    } else {
      console.log("Scenario 2 Status: ❌ FAIL");
    }

    // --- Scenario 3: Appointment Not Found ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 3: Appointment Not Found");
    console.log("--------------------------------------------------");
    const resultNotFound = await cancelAppointment("+15554443333", mockHospital.id);
    console.log("Result:", JSON.stringify(resultNotFound, null, 2));

    if (resultNotFound.status === "FAILED_NOT_FOUND") {
      console.log("Scenario 3 Status: ✅ PASS");
    } else {
      console.log("Scenario 3 Status: ❌ FAIL");
    }

    // --- Scenario 4: Invalid Patient ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 4: Invalid Patient");
    console.log("--------------------------------------------------");
    const resultInvalidPatient = await cancelAppointment("+15550000000", mockHospital.id);
    console.log("Result:", JSON.stringify(resultInvalidPatient, null, 2));

    if (resultInvalidPatient.status === "FAILED_INVALID_PATIENT") {
      console.log("Scenario 4 Status: ✅ PASS");
    } else {
      console.log("Scenario 4 Status: ❌ FAIL");
    }

  } catch (error) {
    console.error("❌ Test script crashed with error:", error);
  } finally {
    // 2. Clean up mock database records
    console.log("\n🧹 Cleaning up temporary test data from database...");
    
    if (mockAppt) {
      await prisma.appointment.delete({ where: { id: mockAppt.id } }).catch(() => {});
    }

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

runCancellationTest();
