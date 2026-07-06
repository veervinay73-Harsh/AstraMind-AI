import { WebSocket } from 'ws';
import { orchestrateTurn } from '../src/services/orchestrator';
import { clearSessionState, getSessionState } from '../src/services/stateManager';
import prisma from '../src/config/prisma';

const DASHBOARD_WS_URL = 'ws://localhost:5000/api/dashboard';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runE2E() {
  console.log("=== STARTING APPOINTMENT LIFECYCLE E2E TEST ===");

  const dashboardWs = new WebSocket(DASHBOARD_WS_URL);
  const messages: any[] = [];
  dashboardWs.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    messages.push(msg);
    if (msg.type === 'REFRESH_DASHBOARD' || msg.event === 'REFRESH_DASHBOARD') {
      console.log(`[DASHBOARD WS] Received REFRESH_DASHBOARD event`);
    } else {
      console.log(`[DASHBOARD WS] Event: ${msg.event}`);
    }
  });

  await new Promise((resolve, reject) => {
    dashboardWs.on('open', resolve);
    dashboardWs.on('error', reject);
  });
  console.log("Dashboard WebSocket connected.");

  // Pre-requisite: ensure hospital exists
  const hospital = await prisma.hospital.findFirst();
  if (!hospital) {
    console.error("No hospital found!");
    process.exit(1);
  }
  const hospitalId = hospital.id;

  // Pre-requisite: Clean up previous test patients and appointments by normalized phone digits
  const allPatients = await prisma.patient.findMany();
  const matchedPatientIds = allPatients
    .filter(p => {
      const pDigits = p.phone.replace(/\D/g, '');
      return pDigits.endsWith('8105558817') || '8105558817'.endsWith(pDigits) || p.name === 'Vinay';
    })
    .map(p => p.id);

  if (matchedPatientIds.length > 0) {
    await prisma.appointment.deleteMany({
      where: { patientId: { in: matchedPatientIds } }
    });
    await prisma.patient.deleteMany({
      where: { id: { in: matchedPatientIds } }
    });
    console.log(`Deleted existing patients matching phone or name: ${matchedPatientIds.join(', ')}`);
  } else {
    console.log("No existing patients matching phone or name found to delete.");
  }

  // Dynamically upsert Dr. Robert Smith (Cardiologist)
  await prisma.doctor.upsert({
    where: { id: 'seed-doctor-001' },
    update: {
      name: 'Dr. Robert Smith',
      specialization: 'Cardiology',
      isActive: true,
      hospitalId
    },
    create: {
      id: 'seed-doctor-001',
      name: 'Dr. Robert Smith',
      specialization: 'Cardiology',
      isActive: true,
      hospitalId
    }
  });

  // Dynamically upsert Dr. Michael Patel (Cardiologist)
  const doctorPatel = await prisma.doctor.upsert({
    where: { id: 'seed-doctor-patel' },
    update: {
      name: 'Dr. Michael Patel',
      specialization: 'Cardiology',
      isActive: true,
      hospitalId
    },
    create: {
      id: 'seed-doctor-patel',
      name: 'Dr. Michael Patel',
      specialization: 'Cardiology',
      isActive: true,
      hospitalId
    }
  });

  console.log("Dr. Robert Smith and Dr. Michael Patel (Cardiologists) are verified/upserted in the database.");

  const callerPhone = '810-555-8817';

  // ==========================================
  // SCENARIO 1: BOOK APPOINTMENT
  // ==========================================
  console.log("\n--- Scenario 1: Book Appointment ---");
  const callSid1 = 'lifecycle-test-1';
  clearSessionState(callSid1);

  const bookingUtterances = [
    "I want to book an appointment.",
    "My name is Vinay",
    "810-555-8817",
    "Dr. Robert Smith",
    "July 7, 2026",
    "2:00 PM"
  ];

  for (const utterance of bookingUtterances) {
    console.log(`User: "${utterance}"`);
    await orchestrateTurn(callSid1, utterance, hospitalId, callerPhone);
    const state = getSessionState(callSid1);
    console.log(`AI state: ${state.state} | Lifecycle: ${state.lifecycleState}`);
  }

  console.log('User: "Yes"');
  await orchestrateTurn(callSid1, "Yes", hospitalId, callerPhone);
  await delay(1000);

  // Verify S1 Booking in DB
  const appt1 = await prisma.appointment.findFirst({
    where: { patient: { name: 'Vinay' } },
    include: { patient: true, doctor: true }
  });

  if (!appt1 || appt1.status !== 'CONFIRMED') {
    console.error("❌ Scenario 1 Failed: Appointment not created or status not CONFIRMED!");
    process.exit(1);
  }
  console.log(`✅ Booking verified in DB! Status: ${appt1.status}, ID: ${appt1.id}`);
  const initialApptId = appt1.id;

  // ==========================================
  // SCENARIO 2: RETURNING CALLER IDENTIFICATION
  // ==========================================
  console.log("\n--- Scenario 2: Returning Caller Identification ---");
  const callSid2 = 'lifecycle-test-2';
  clearSessionState(callSid2);

  // Trigger first turn which should auto-load patient details
  console.log('User: "Hello, I want to check my appointments."');
  await orchestrateTurn(callSid2, "Hello, I want to check my appointments.", hospitalId, callerPhone);
  const state2 = getSessionState(callSid2);

  if (!state2.patientExists || state2.patient_name !== 'Vinay' || state2.activeAppointmentId !== initialApptId) {
    console.error("❌ Scenario 2 Failed: Patient identification or active appointment lookup failed!");
    console.log(state2);
    process.exit(1);
  }
  console.log(`✅ Returning patient identified! Name: ${state2.patient_name}, Active Appointment: ${state2.activeAppointmentId}`);

  // ==========================================
  // SCENARIO 3: RESCHEDULE APPOINTMENT
  // ==========================================
  console.log("\n--- Scenario 3: Reschedule Appointment ---");
  console.log('User: "Reschedule my appointment."');
  await orchestrateTurn(callSid2, "Reschedule my appointment.", hospitalId, callerPhone);
  const state3Resched = getSessionState(callSid2);
  console.log(`AI State: ${state3Resched.state} | Lifecycle: ${state3Resched.lifecycleState}`);

  console.log('User: "July 8, 2026"');
  await orchestrateTurn(callSid2, "July 8, 2026", hospitalId, callerPhone);
  console.log('User: "3:00 PM"');
  await orchestrateTurn(callSid2, "3:00 PM", hospitalId, callerPhone);
  
  const state3Confirm = getSessionState(callSid2);
  console.log(`AI State: ${state3Confirm.state} | Lifecycle: ${state3Confirm.lifecycleState}`);

  console.log('User: "Yes"');
  await orchestrateTurn(callSid2, "Yes", hospitalId, callerPhone);
  await delay(1000);

  // Verify Reschedule in DB
  const appt3 = await prisma.appointment.findUnique({
    where: { id: initialApptId }
  });

  if (!appt3 || appt3.status !== 'RESCHEDULED' || !appt3.previousDateTime) {
    console.error("❌ Scenario 3 Failed: Appointment reschedule DB update failed!");
    process.exit(1);
  }
  console.log(`✅ Reschedule verified in DB! Status: ${appt3.status}, New Date: ${appt3.dateTime.toISOString()}, Prev Date: ${appt3.previousDateTime.toISOString()}`);

  // ==========================================
  // SCENARIO 4: CHANGE DOCTOR
  // ==========================================
  console.log("\n--- Scenario 4: Change Doctor ---");
  const callSid3 = 'lifecycle-test-3';
  clearSessionState(callSid3);

  console.log('User: "I want another doctor."');
  await orchestrateTurn(callSid3, "I want another doctor.", hospitalId, callerPhone);
  const state4Doctor = getSessionState(callSid3);
  console.log(`AI State: ${state4Doctor.state} | Lifecycle: ${state4Doctor.lifecycleState}`);
  console.log("Recommended Doctors:", state4Doctor.recommended_doctors);

  // Choose Dr. Michael Patel
  console.log(`User: "Michael Patel"`);
  await orchestrateTurn(callSid3, "Michael Patel", hospitalId, callerPhone);
  const state4DoctorConfirm = getSessionState(callSid3);
  console.log(`AI State: ${state4DoctorConfirm.state} | Lifecycle: ${state4DoctorConfirm.lifecycleState}`);

  console.log('User: "Yes"');
  await orchestrateTurn(callSid3, "Yes", hospitalId, callerPhone);
  await delay(1000);

  // Verify Doctor Changed in DB
  const appt4 = await prisma.appointment.findUnique({
    where: { id: initialApptId },
    include: { doctor: true }
  });

  if (!appt4 || appt4.status !== 'DOCTOR_CHANGED' || appt4.doctorId !== doctorPatel.id) {
    console.error("❌ Scenario 4 Failed: Doctor change DB update failed!");
    process.exit(1);
  }
  console.log(`✅ Doctor Change verified in DB! Status: ${appt4.status}, Doctor Assigned: ${appt4.doctor.name}`);

  // ==========================================
  // SCENARIO 5: CHANGE DATE
  // ==========================================
  console.log("\n--- Scenario 5: Change Date ---");
  const callSid4 = 'lifecycle-test-4';
  clearSessionState(callSid4);

  console.log('User: "Change the date of my appointment."');
  await orchestrateTurn(callSid4, "Change the date of my appointment.", hospitalId, callerPhone);
  console.log('User: "July 9, 2026"');
  await orchestrateTurn(callSid4, "July 9, 2026", hospitalId, callerPhone);
  
  console.log('User: "Yes"');
  await orchestrateTurn(callSid4, "Yes", hospitalId, callerPhone);
  await delay(1000);

  // Verify Date Change in DB
  const appt5 = await prisma.appointment.findUnique({
    where: { id: initialApptId }
  });

  if (!appt5 || appt5.dateTime.toISOString().substring(0, 10) !== '2026-07-09') {
    console.error("❌ Scenario 5 Failed: Date change DB update failed!");
    process.exit(1);
  }
  console.log(`✅ Date Change verified in DB! New Date: ${appt5.dateTime.toISOString().substring(0, 10)}`);

  // ==========================================
  // SCENARIO 6: CHANGE TIME
  // ==========================================
  console.log("\n--- Scenario 6: Change Time ---");
  const callSid5 = 'lifecycle-test-5';
  clearSessionState(callSid5);

  console.log('User: "Change the time of my appointment."');
  await orchestrateTurn(callSid5, "Change the time of my appointment.", hospitalId, callerPhone);
  console.log('User: "4:00 PM"');
  await orchestrateTurn(callSid5, "4:00 PM", hospitalId, callerPhone);
  
  console.log('User: "Yes"');
  await orchestrateTurn(callSid5, "Yes", hospitalId, callerPhone);
  await delay(1000);

  // Verify Time Change in DB
  const appt6 = await prisma.appointment.findUnique({
    where: { id: initialApptId }
  });

  if (!appt6) {
    console.error("❌ Scenario 6 Failed: Time change DB update failed!");
    process.exit(1);
  }
  
  const apptTime = appt6.dateTime.getUTCHours();
  if (apptTime !== 16) {
    console.error(`❌ Scenario 6 Failed: Time change DB update failed! Hour was: ${apptTime}`);
    process.exit(1);
  }
  console.log(`✅ Time Change verified in DB! New Time Hour: ${apptTime}:00`);

  // ==========================================
  // SCENARIO 7: CANCEL APPOINTMENT
  // ==========================================
  console.log("\n--- Scenario 7: Cancel Appointment ---");
  const callSid6 = 'lifecycle-test-6';
  clearSessionState(callSid6);

  console.log('User: "Cancel my appointment."');
  await orchestrateTurn(callSid6, "Cancel my appointment.", hospitalId, callerPhone);
  const state6Cancel = getSessionState(callSid6);
  console.log(`AI State: ${state6Cancel.state} | Lifecycle: ${state6Cancel.lifecycleState}`);

  console.log('User: "Yes"');
  await orchestrateTurn(callSid6, "Yes", hospitalId, callerPhone);
  await delay(1000);

  // Verify Cancellation in DB
  const appt7 = await prisma.appointment.findUnique({
    where: { id: initialApptId }
  });

  if (!appt7 || appt7.status !== 'CANCELLED' || !appt7.cancelledAt) {
    console.error("❌ Scenario 7 Failed: Appointment cancellation DB update failed!");
    process.exit(1);
  }
  console.log(`✅ Cancellation verified in DB! Status: ${appt7.status}, Cancelled At: ${appt7.cancelledAt.toISOString()}`);

  dashboardWs.close();
  console.log("\n=== ALL SCENARIOS COMPLETED SUCCESSFULLY ===");
}

runE2E().catch(err => {
  console.error("E2E Test Suite Error", err);
  process.exit(1);
});
