/**
 * AstraMind AI Receptionist - Full Lifecycle E2E Test Suite
 * Tests 7 critical scenarios end-to-end including DB operations
 * 
 * Run: npx ts-node test_lifecycle.ts
 */

import { orchestrateTurn } from './src/services/orchestrator';
import { clearSessionState } from './src/services/stateManager';
import { getLatestActiveAppointmentByPhone } from './src/services/appointmentHelper';
import prisma from './src/config/prisma';

let HOSPITAL_ID = '';

// ─── Colours for terminal ──────────────────────────────────────────────
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

type TestResult = { passed: boolean; scenario: string; detail: string };
const results: TestResult[] = [];

function pass(scenario: string, detail: string) {
  console.log(`  ${GREEN}✅ PASS${RESET} — ${detail}`);
  results.push({ passed: true, scenario, detail });
}

function fail(scenario: string, detail: string) {
  console.log(`  ${RED}❌ FAIL${RESET} — ${detail}`);
  results.push({ passed: false, scenario, detail });
}

async function turn(
  callSid: string,
  utterance: string,
  callerPhone: string
) {
  return orchestrateTurn(callSid, utterance, HOSPITAL_ID, callerPhone);
}

async function resolveHospitalId() {
  const hospital = await prisma.hospital.findFirst();
  if (!hospital) throw new Error('No hospital found in DB. Seed data required.');
  HOSPITAL_ID = hospital.id;
  console.log(`${CYAN}[INFO]${RESET} Using hospital ID: ${HOSPITAL_ID} (${hospital.name})`);
}

// ─── SCENARIO 1: Book an appointment ──────────────────────────────────
async function scenario1_bookAppointment() {
  console.log(`\n${BOLD}${CYAN}=== SCENARIO 1: Book Appointment ===${RESET}`);
  const callSid = 'test_s1_book';
  const callerPhone = '+15550001001';

  // Clean existing data for this test phone
  const existingPatient = await prisma.patient.findUnique({
    where: { hospitalId_phone: { hospitalId: HOSPITAL_ID, phone: callerPhone } }
  });
  if (existingPatient) {
    await prisma.appointment.deleteMany({ where: { patientId: existingPatient.id } });
    await prisma.patient.delete({ where: { id: existingPatient.id } });
  }

  clearSessionState(callSid);

  await turn(callSid, 'Hello I want to book an appointment', callerPhone);
  await turn(callSid, 'My name is Alice Test', callerPhone);
  await turn(callSid, callerPhone, callerPhone); // phone number
  
  // Get a real doctor
  const doctor = await prisma.doctor.findFirst({ where: { hospitalId: HOSPITAL_ID, isActive: true } });
  if (!doctor) { fail('Scenario 1', 'No active doctor found in DB'); return; }

  await turn(callSid, `I want to see ${doctor.name}`, callerPhone);
  await turn(callSid, '2026-12-15', callerPhone);
  await turn(callSid, '10:00 AM', callerPhone);
  const confirmResult = await turn(callSid, 'Yes confirm it', callerPhone);

  // Check DB
  const appt = await getLatestActiveAppointmentByPhone(HOSPITAL_ID, callerPhone);
  if (appt && (appt.status === 'CONFIRMED' || appt.status === 'RESCHEDULED')) {
    pass('Scenario 1', `Appointment created in DB: ${appt.id}, status: ${appt.status}`);
  } else {
    fail('Scenario 1', `No active appointment found in DB. Orchestrator result: ${JSON.stringify(confirmResult.selected_tool)}`);
  }
}

// ─── SCENARIO 2: Book + Cancel immediately ────────────────────────────
async function scenario2_bookAndCancel() {
  console.log(`\n${BOLD}${CYAN}=== SCENARIO 2: Book then Cancel ===${RESET}`);
  const bookCallSid = 'test_s2_book';
  const cancelCallSid = 'test_s2_cancel';
  const callerPhone = '+15550002001';

  // Clean
  const existing = await prisma.patient.findUnique({
    where: { hospitalId_phone: { hospitalId: HOSPITAL_ID, phone: callerPhone } }
  });
  if (existing) {
    await prisma.appointment.deleteMany({ where: { patientId: existing.id } });
    await prisma.patient.delete({ where: { id: existing.id } });
  }

  clearSessionState(bookCallSid);
  const doctor = await prisma.doctor.findFirst({ where: { hospitalId: HOSPITAL_ID, isActive: true } });
  if (!doctor) { fail('Scenario 2', 'No active doctor found'); return; }

  await turn(bookCallSid, 'Book an appointment', callerPhone);
  await turn(bookCallSid, 'My name is Bob Test', callerPhone);
  await turn(bookCallSid, callerPhone, callerPhone);
  await turn(bookCallSid, `I want ${doctor.name}`, callerPhone);
  await turn(bookCallSid, '2026-12-20', callerPhone);
  await turn(bookCallSid, '11:00 AM', callerPhone);
  await turn(bookCallSid, 'Yes', callerPhone);

  // Verify booked
  const bookedAppt = await getLatestActiveAppointmentByPhone(HOSPITAL_ID, callerPhone);
  if (!bookedAppt) {
    fail('Scenario 2', 'Appointment was not booked. Cannot test cancellation.');
    return;
  }
  console.log(`  ${YELLOW}[INFO]${RESET} Appointment booked: ${bookedAppt.id}`);

  // Now cancel in new call session
  clearSessionState(cancelCallSid);
  await turn(cancelCallSid, 'I want to cancel my appointment', callerPhone);
  const cancelResult = await turn(cancelCallSid, 'Yes cancel it', callerPhone);

  // Verify cancelled in DB
  const cancelledAppt = await prisma.appointment.findUnique({ where: { id: bookedAppt.id } });
  if (cancelledAppt?.status === 'CANCELLED') {
    pass('Scenario 2', `Appointment cancelled successfully: ${cancelledAppt.id}`);
  } else {
    fail('Scenario 2', `Cancel failed. Status: ${cancelledAppt?.status}, Tool: ${cancelResult.selected_tool}`);
  }
}

// ─── SCENARIO 3: Cancel non-existent appointment ─────────────────────
async function scenario3_cancelNonExistent() {
  console.log(`\n${BOLD}${CYAN}=== SCENARIO 3: Cancel When No Appointment Exists ===${RESET}`);
  const callSid = 'test_s3_cancel';
  const callerPhone = '+15550003001';

  // Clean
  const existing = await prisma.patient.findUnique({
    where: { hospitalId_phone: { hospitalId: HOSPITAL_ID, phone: callerPhone } }
  });
  if (existing) {
    await prisma.appointment.deleteMany({ where: { patientId: existing.id } });
    await prisma.patient.delete({ where: { id: existing.id } });
  }

  clearSessionState(callSid);
  await turn(callSid, 'I want to cancel my appointment', callerPhone);
  const result = await turn(callSid, 'Yes cancel it', callerPhone);

  // Should gracefully fail - not crash
  if (result.result?.status === 'FAILED_NOT_FOUND' || result.selected_tool === 'NONE' || result.result?.message) {
    pass('Scenario 3', `Graceful failure when no appointment exists. Result: ${result.result?.status || 'NONE'}`);
  } else {
    fail('Scenario 3', `Unexpected result: ${JSON.stringify(result)}`);
  }
}

// ─── SCENARIO 4: Reschedule existing appointment ──────────────────────
async function scenario4_reschedule() {
  console.log(`\n${BOLD}${CYAN}=== SCENARIO 4: Reschedule Appointment ===${RESET}`);
  const bookCallSid = 'test_s4_book';
  const reschedCallSid = 'test_s4_resched';
  const callerPhone = '+15550004001';

  // Clean
  const existing = await prisma.patient.findUnique({
    where: { hospitalId_phone: { hospitalId: HOSPITAL_ID, phone: callerPhone } }
  });
  if (existing) {
    await prisma.appointment.deleteMany({ where: { patientId: existing.id } });
    await prisma.patient.delete({ where: { id: existing.id } });
  }

  // Book first
  clearSessionState(bookCallSid);
  const doctor = await prisma.doctor.findFirst({ where: { hospitalId: HOSPITAL_ID, isActive: true } });
  if (!doctor) { fail('Scenario 4', 'No active doctor found'); return; }

  await turn(bookCallSid, 'Book appointment', callerPhone);
  await turn(bookCallSid, 'My name is Carol Test', callerPhone);
  await turn(bookCallSid, callerPhone, callerPhone);
  await turn(bookCallSid, doctor.name, callerPhone);
  await turn(bookCallSid, '2026-12-10', callerPhone);
  await turn(bookCallSid, '9:00 AM', callerPhone);
  await turn(bookCallSid, 'Yes', callerPhone);

  const originalAppt = await getLatestActiveAppointmentByPhone(HOSPITAL_ID, callerPhone);
  if (!originalAppt) { fail('Scenario 4', 'Could not book appointment for reschedule test'); return; }
  const originalDate = originalAppt.dateTime.toISOString();
  console.log(`  ${YELLOW}[INFO]${RESET} Original appointment: ${originalDate}`);

  // Now reschedule
  clearSessionState(reschedCallSid);
  await turn(reschedCallSid, 'I want to reschedule my appointment', callerPhone);
  await turn(reschedCallSid, '2026-12-25', callerPhone);
  await turn(reschedCallSid, '2:00 PM', callerPhone);
  const reschedResult = await turn(reschedCallSid, 'Yes confirm it', callerPhone);

  // Verify DB
  const updatedAppt = await prisma.appointment.findUnique({ where: { id: originalAppt.id } });
  if (updatedAppt?.status === 'RESCHEDULED') {
    pass('Scenario 4', `Appointment rescheduled. New date: ${updatedAppt.dateTime.toISOString()}`);
  } else {
    fail('Scenario 4', `Reschedule failed. Status: ${updatedAppt?.status}, Tool: ${reschedResult.selected_tool}`);
  }
}

// ─── SCENARIO 5: Change doctor ────────────────────────────────────────
async function scenario5_changeDoctor() {
  console.log(`\n${BOLD}${CYAN}=== SCENARIO 5: Change Doctor ===${RESET}`);
  const bookCallSid = 'test_s5_book';
  const changeCallSid = 'test_s5_change';
  const callerPhone = '+15550005001';

  // Clean
  const existing = await prisma.patient.findUnique({
    where: { hospitalId_phone: { hospitalId: HOSPITAL_ID, phone: callerPhone } }
  });
  if (existing) {
    await prisma.appointment.deleteMany({ where: { patientId: existing.id } });
    await prisma.patient.delete({ where: { id: existing.id } });
  }

  // Get two doctors
  const doctors = await prisma.doctor.findMany({ where: { hospitalId: HOSPITAL_ID, isActive: true }, take: 2 });
  if (doctors.length < 2) { fail('Scenario 5', 'Need at least 2 active doctors'); return; }

  const doctor1 = doctors[0];
  const doctor2 = doctors[1];

  // Book with doctor1
  clearSessionState(bookCallSid);
  await turn(bookCallSid, 'Book appointment', callerPhone);
  await turn(bookCallSid, 'My name is Dan Test', callerPhone);
  await turn(bookCallSid, callerPhone, callerPhone);
  await turn(bookCallSid, doctor1.name, callerPhone);
  await turn(bookCallSid, '2026-12-15', callerPhone);
  await turn(bookCallSid, '10:00 AM', callerPhone);
  await turn(bookCallSid, 'Yes', callerPhone);

  const appt = await getLatestActiveAppointmentByPhone(HOSPITAL_ID, callerPhone);
  if (!appt) { fail('Scenario 5', 'Could not book original appointment'); return; }
  console.log(`  ${YELLOW}[INFO]${RESET} Booked with ${doctor1.name} (${appt.doctorId})`);

  // Now change to doctor2
  clearSessionState(changeCallSid);
  await turn(changeCallSid, 'Change my doctor', callerPhone);
  await turn(changeCallSid, `I want to switch to ${doctor2.name}`, callerPhone);
  const changeResult = await turn(changeCallSid, 'Yes confirm it', callerPhone);

  const updatedAppt = await prisma.appointment.findUnique({ where: { id: appt.id } });
  if (updatedAppt?.doctorId === doctor2.id && updatedAppt?.status === 'DOCTOR_CHANGED') {
    pass('Scenario 5', `Doctor changed from ${doctor1.name} to ${doctor2.name}`);
  } else {
    fail('Scenario 5', `Change failed. doctorId: ${updatedAppt?.doctorId}, status: ${updatedAppt?.status}, tool: ${changeResult.selected_tool}`);
  }
}

// ─── SCENARIO 6: Duplicate booking → update (not create new) ─────────
async function scenario6_duplicateBookingUpdate() {
  console.log(`\n${BOLD}${CYAN}=== SCENARIO 6: Duplicate Booking → Should Update ===${RESET}`);
  const callSid1 = 'test_s6_book1';
  const callSid2 = 'test_s6_book2';
  const callerPhone = '+15550006001';

  // Clean
  const existing = await prisma.patient.findUnique({
    where: { hospitalId_phone: { hospitalId: HOSPITAL_ID, phone: callerPhone } }
  });
  if (existing) {
    await prisma.appointment.deleteMany({ where: { patientId: existing.id } });
    await prisma.patient.delete({ where: { id: existing.id } });
  }

  const doctor = await prisma.doctor.findFirst({ where: { hospitalId: HOSPITAL_ID, isActive: true } });
  if (!doctor) { fail('Scenario 6', 'No active doctor found'); return; }

  // First booking
  clearSessionState(callSid1);
  await turn(callSid1, 'Book appointment', callerPhone);
  await turn(callSid1, 'Eve Test', callerPhone);
  await turn(callSid1, callerPhone, callerPhone);
  await turn(callSid1, doctor.name, callerPhone);
  await turn(callSid1, '2026-12-10', callerPhone);
  await turn(callSid1, '9:00 AM', callerPhone);
  await turn(callSid1, 'Yes', callerPhone);

  const firstAppt = await getLatestActiveAppointmentByPhone(HOSPITAL_ID, callerPhone);
  if (!firstAppt) { fail('Scenario 6', 'First booking failed'); return; }

  const countBefore = await prisma.appointment.count({ where: { patientId: firstAppt.patientId } });
  console.log(`  ${YELLOW}[INFO]${RESET} Appointment count before second booking: ${countBefore}`);

  // Second booking attempt (duplicate → should update existing)
  clearSessionState(callSid2);
  await turn(callSid2, 'Book appointment', callerPhone);
  await turn(callSid2, 'Eve Test', callerPhone);
  await turn(callSid2, callerPhone, callerPhone);
  await turn(callSid2, doctor.name, callerPhone);
  await turn(callSid2, '2026-12-20', callerPhone); // Different date
  await turn(callSid2, '3:00 PM', callerPhone);
  await turn(callSid2, 'Yes', callerPhone);

  const countAfter = await prisma.appointment.count({ where: { patientId: firstAppt.patientId } });
  console.log(`  ${YELLOW}[INFO]${RESET} Appointment count after second booking: ${countAfter}`);

  if (countAfter === countBefore) {
    pass('Scenario 6', `No duplicate created! Count stayed at ${countAfter} - existing appointment updated.`);
  } else {
    fail('Scenario 6', `Duplicate created! Count went from ${countBefore} to ${countAfter}`);
  }
}

// ─── SCENARIO 7: Dashboard data consistency ───────────────────────────
async function scenario7_dashboardConsistency() {
  console.log(`\n${BOLD}${CYAN}=== SCENARIO 7: Dashboard Consistency Check ===${RESET}`);
  
  try {
    const baseUrl = 'http://localhost:5000/api';
    
    // Check appointments endpoint returns data
    const apptsRes = await fetch(`${baseUrl}/appointments?hospitalId=${HOSPITAL_ID}&limit=5&status=CONFIRMED,RESCHEDULED,DOCTOR_CHANGED`);
    const analytics = await fetch(`${baseUrl}/analytics?period=today`);

    if (!apptsRes.ok) {
      fail('Scenario 7', `Appointments API returned ${apptsRes.status}`);
      return;
    }
    if (!analytics.ok) {
      fail('Scenario 7', `Analytics API returned ${analytics.status}`);
      return;
    }

    const apptsData = await apptsRes.json() as any;
    const analyticsData = await analytics.json() as any;

    const hasAppointments = Array.isArray(apptsData.appointments);
    const hasKpis = analyticsData.kpis !== undefined;

    if (hasAppointments && hasKpis) {
      pass('Scenario 7', `Dashboard APIs healthy. ${apptsData.appointments.length} active appointments. KPIs: ${JSON.stringify(analyticsData.kpis)}`);
    } else {
      fail('Scenario 7', `API shape incorrect. appointments: ${hasAppointments}, kpis: ${hasKpis}`);
    }
  } catch (err) {
    fail('Scenario 7', `API connectivity error: ${err}`);
  }
}

// ─── MAIN RUNNER ──────────────────────────────────────────────────────
async function run() {
  console.log(`\n${BOLD}${CYAN}╔════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${CYAN}║  AstraMind Lifecycle Test Suite            ║${RESET}`);
  console.log(`${BOLD}${CYAN}╚════════════════════════════════════════════╝${RESET}\n`);

  await resolveHospitalId();

  await scenario1_bookAppointment();
  await scenario2_bookAndCancel();
  await scenario3_cancelNonExistent();
  await scenario4_reschedule();
  await scenario5_changeDoctor();
  await scenario6_duplicateBookingUpdate();
  await scenario7_dashboardConsistency();

  // ─── Summary ──────────────────────────────────────────────────────
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n${BOLD}╔════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}║  FINAL RESULTS: ${passed}/${results.length} PASSED                  ║${RESET}`);
  console.log(`${BOLD}╚════════════════════════════════════════════╝${RESET}`);

  if (failed > 0) {
    console.log(`\n${RED}${BOLD}Failed Scenarios:${RESET}`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ${RED}❌${RESET} ${r.scenario}: ${r.detail}`);
    });
  } else {
    console.log(`\n${GREEN}${BOLD}🎉 ALL SCENARIOS PASSED!${RESET}`);
  }

  return failed;
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
