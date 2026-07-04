import dotenv from 'dotenv';
import prisma from '../src/config/prisma';
import { bookAppointment } from '../src/services/booking';
import { BookingState } from '../src/services/stateManager';

dotenv.config();

async function runBookingTest() {
  console.log("🤖 Starting Appointment Booking Engine Verification Test...\n");

  let mockHospital: any = null;
  let mockDoctor: any = null;
  const createdApptIds: string[] = [];

  try {
    // 1. Setup mock data
    console.log("📦 Provisioning temporary test data in database...");
    
    mockHospital = await prisma.hospital.create({
      data: {
        name: "AstraMind Booking Test Hospital",
        address: "456 Clinic Lane",
        phone: "+15559998888",
      }
    });

    mockDoctor = await prisma.doctor.create({
      data: {
        name: "Dr. Robert Smith",
        specialization: "Cardiology",
        email: "robert.smith@bookingtest.com",
        phone: "+15551112222",
        hospitalId: mockHospital.id,
      }
    });

    console.log("✅ Temporary test data successfully provisioned.");
    const callSid = "test_call_sid_booking_flow_999";

    // --- Scenario 1: Successful Booking ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 1: Successful Booking");
    console.log("--------------------------------------------------");
    const stateSuccess: BookingState = {
      intent: "BOOK_APPOINTMENT",
      state: "CONFIRMATION_REQUIRED",
      patient_name: "John Doe",
      doctor: "Cardiology",
      date: "2026-07-04",
      time: "10:00 AM",
      phone: "+15557778888",
      missing_fields: []
    };

    const resultSuccess = await bookAppointment(callSid, stateSuccess, mockHospital.id);
    console.log("Result:", JSON.stringify(resultSuccess, null, 2));
    
    if (resultSuccess.status === "BOOKED" && resultSuccess.appointmentId) {
      console.log("Scenario 1 Status: ✅ PASS");
      createdApptIds.push(resultSuccess.appointmentId);
    } else {
      console.log("Scenario 1 Status: ❌ FAIL");
    }

    // --- Scenario 2: Slot Already Occupied ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 2: Slot Already Occupied");
    console.log("--------------------------------------------------");
    const stateOccupied: BookingState = {
      intent: "BOOK_APPOINTMENT",
      state: "CONFIRMATION_REQUIRED",
      patient_name: "Jane Smith",
      doctor: "Cardiology",
      date: "2026-07-04",
      time: "10:00 AM",
      phone: "+15556667777",
      missing_fields: []
    };

    const resultOccupied = await bookAppointment(callSid, stateOccupied, mockHospital.id);
    console.log("Result:", JSON.stringify(resultOccupied, null, 2));

    if (resultOccupied.status === "FAILED_SLOT_OCCUPIED") {
      console.log("Scenario 2 Status: ✅ PASS");
    } else {
      console.log("Scenario 2 Status: ❌ FAIL");
    }

    // --- Scenario 3: Invalid Doctor ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 3: Invalid Doctor / Department");
    console.log("--------------------------------------------------");
    const stateInvalidDoc: BookingState = {
      intent: "BOOK_APPOINTMENT",
      state: "CONFIRMATION_REQUIRED",
      patient_name: "John Doe",
      doctor: "Astronaut Specialist",
      date: "2026-07-04",
      time: "11:00 AM",
      phone: "+15557778888",
      missing_fields: []
    };

    const resultInvalidDoc = await bookAppointment(callSid, stateInvalidDoc, mockHospital.id);
    console.log("Result:", JSON.stringify(resultInvalidDoc, null, 2));

    if (resultInvalidDoc.status === "FAILED_DOCTOR_NOT_FOUND") {
      console.log("Scenario 3 Status: ✅ PASS");
    } else {
      console.log("Scenario 3 Status: ❌ FAIL");
    }

    // --- Scenario 4: Missing Required Fields ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 4: Missing Required Fields");
    console.log("--------------------------------------------------");
    const stateMissingFields: BookingState = {
      intent: "BOOK_APPOINTMENT",
      state: "COLLECTING_INFORMATION",
      patient_name: "John Doe",
      doctor: null, // missing doctor
      date: "2026-07-04",
      time: "10:00 AM",
      phone: null, // missing phone
      missing_fields: ["doctor", "phone"]
    };

    const resultMissingFields = await bookAppointment(callSid, stateMissingFields, mockHospital.id);
    console.log("Result:", JSON.stringify(resultMissingFields, null, 2));

    if (resultMissingFields.status === "FAILED_MISSING_FIELDS") {
      console.log("Scenario 4 Status: ✅ PASS");
    } else {
      console.log("Scenario 4 Status: ❌ FAIL");
    }

  } catch (error) {
    console.error("❌ Test script crashed with error:", error);
  } finally {
    // 2. Clean up mock database records
    console.log("\n🧹 Cleaning up temporary test data from database...");
    
    // Delete created appointments
    for (const apptId of createdApptIds) {
      await prisma.appointment.delete({ where: { id: apptId } }).catch(() => {});
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

runBookingTest();
