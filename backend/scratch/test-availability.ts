import dotenv from 'dotenv';
import prisma from '../src/config/prisma';
import { getDoctorAvailability } from '../src/services/availability';

dotenv.config();

async function runAvailabilityTest() {
  console.log("🤖 Starting Doctor Availability Engine Verification Test...\n");

  let mockHospital: any = null;
  let mockDoctor: any = null;
  let mockAppt1: any = null;
  let mockAppt2: any = null;

  try {
    // 1. Setup mock data
    console.log("📦 Provisioning temporary test data in database...");
    
    mockHospital = await prisma.hospital.create({
      data: {
        name: "Test General Hospital",
        address: "123 Test St",
        phone: "+15550001111",
      }
    });

    mockDoctor = await prisma.doctor.create({
      data: {
        name: "Dr. Robert Smith",
        specialization: "Cardiology",
        email: "robert.smith@test.com",
        phone: "+15552223333",
        hospitalId: mockHospital.id,
      }
    });

    // Create a temporary patient to associate with appointments
    const mockPatient = await prisma.patient.create({
      data: {
        name: "Test Patient",
        phone: "+15559998888",
        email: "patient@test.com",
        hospitalId: mockHospital.id,
      }
    });

    // Create conflict 1: Booked appointment at 10:30 AM (duration 30 mins)
    mockAppt1 = await prisma.appointment.create({
      data: {
        patientId: mockPatient.id,
        doctorId: mockDoctor.id,
        dateTime: new Date(Date.UTC(2026, 6, 4, 10, 30, 0)), // 2026-07-04T10:30:00Z
        duration: 30,
        hospitalId: mockHospital.id,
      }
    });

    // Create conflict 2: Booked appointment at 2:00 PM (duration 60 mins - occupies 2:00 PM and 2:30 PM slots)
    mockAppt2 = await prisma.appointment.create({
      data: {
        patientId: mockPatient.id,
        doctorId: mockDoctor.id,
        dateTime: new Date(Date.UTC(2026, 6, 4, 14, 0, 0)), // 2026-07-04T14:00:00Z
        duration: 60,
        hospitalId: mockHospital.id,
      }
    });

    console.log("✅ Temporary test data successfully provisioned.");

    // 2. Run the availability engine query
    console.log("\n🔍 Querying availability for 'Cardiology' on '2026-07-04'...");
    const results = await getDoctorAvailability("Cardiology", "2026-07-04");

    console.log("\n📋 Result Payload:");
    console.log(JSON.stringify(results, null, 2));

    // 3. Assertions
    if (results.length === 0) {
      throw new Error("FAIL: No doctor availability returned.");
    }

    const docAvail = results[0];
    
    // Check conflicts are filtered out
    const conflict1Exists = docAvail.availableSlots.includes("2026-07-04T10:30:00");
    const conflict2Exists = docAvail.availableSlots.includes("2026-07-04T14:00:00") || docAvail.availableSlots.includes("2026-07-04T14:30:00");
    const standardSlotExists = docAvail.availableSlots.includes("2026-07-04T09:00:00");

    console.log("\n🛡️ Verifying Conflict Detection...");
    console.log(`- 10:30 AM Slot filtered out: ${!conflict1Exists ? "✅ YES (PASS)" : "❌ NO (FAIL)"}`);
    console.log(`- 2:00 PM / 2:30 PM Slots filtered out: ${!conflict2Exists ? "✅ YES (PASS)" : "❌ NO (FAIL)"}`);
    console.log(`- 9:00 AM standard slot available: ${standardSlotExists ? "✅ YES (PASS)" : "❌ NO (FAIL)"}`);

    if (conflict1Exists || conflict2Exists || !standardSlotExists) {
      console.log("\n❌ Status: FAIL (Availability checks failed)");
    } else {
      console.log("\n🎉 Status: PASS (Availability Engine & Conflict Detection functioning perfectly!)");
    }

  } catch (error) {
    console.error("❌ Test failed with error:", error);
  } finally {
    // 4. Cleanup database state
    console.log("\n🧹 Cleaning up temporary test data from database...");
    
    if (mockAppt1) await prisma.appointment.delete({ where: { id: mockAppt1.id } }).catch(() => {});
    if (mockAppt2) await prisma.appointment.delete({ where: { id: mockAppt2.id } }).catch(() => {});
    
    // Delete all temporary records in hospital to cascading clean up
    if (mockDoctor) await prisma.doctor.delete({ where: { id: mockDoctor.id } }).catch(() => {});
    if (mockHospital) {
      await prisma.patient.deleteMany({ where: { hospitalId: mockHospital.id } }).catch(() => {});
      await prisma.hospital.delete({ where: { id: mockHospital.id } }).catch(() => {});
    }

    console.log("🧹 Cleanup complete.");
    process.exit(0);
  }
}

runAvailabilityTest();
