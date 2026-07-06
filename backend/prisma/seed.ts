import 'dotenv/config';
import prisma from '../src/config/prisma';
import { AppointmentStatus } from '../src/generated/prisma';

async function main() {
  console.log('🌱 Seeding AstraMind AI database...\n');

  // ── 1. Create Hospital ───────────────────────────────────────────────────────
  const hospital = await prisma.hospital.upsert({
    where: { id: 'seed-hospital-001' },
    update: {},
    create: {
      id: 'seed-hospital-001',
      name: 'AstraMind General Hospital',
      address: '100 Medical Drive, San Francisco, CA 94102',
      phone: '+1 (555) 800-0000',
      timezone: 'America/Los_Angeles',
    },
  });
  console.log(`✅ Hospital: ${hospital.name} (${hospital.id})`);

  // ── 2. Create Doctors ────────────────────────────────────────────────────────
  const doctorsData = [
    {
      id: 'seed-doctor-001',
      name: 'Dr. Robert Smith',
      specialization: 'Cardiology',
      email: 'robert.smith@astramind.com',
      phone: '+1 (555) 888-1001',
      isActive: true,
      consultationFee: 150.0,
      experienceYears: 15,
      qualification: 'MD, FACC',
      profileImage: 'https://i.pravatar.cc/150?u=robert',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTimeSlots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'],
    },
    {
      id: 'seed-doctor-002',
      name: 'Dr. Amanda Ross',
      specialization: 'Pediatrics',
      email: 'amanda.ross@astramind.com',
      phone: '+1 (555) 888-1002',
      isActive: true,
      consultationFee: 120.0,
      experienceYears: 10,
      qualification: 'MD, FAAP',
      profileImage: 'https://i.pravatar.cc/150?u=amanda',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTimeSlots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'],
    },
    {
      id: 'seed-doctor-003',
      name: 'Dr. Sarah Johnson',
      specialization: 'Orthopedics',
      email: 'sarah.johnson@astramind.com',
      phone: '+1 (555) 888-1003',
      isActive: true,
      consultationFee: 200.0,
      experienceYears: 12,
      qualification: 'MD, FAAOS',
      profileImage: 'https://i.pravatar.cc/150?u=sarah',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTimeSlots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'],
    },
    {
      id: 'seed-doctor-004',
      name: 'Dr. Michael Chen',
      specialization: 'Dermatology',
      email: 'michael.chen@astramind.com',
      phone: '+1 (555) 888-1004',
      isActive: true,
      consultationFee: 180.0,
      experienceYears: 8,
      qualification: 'MD, FAAD',
      profileImage: 'https://i.pravatar.cc/150?u=michael',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTimeSlots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'],
    },
    {
      id: 'seed-doctor-005',
      name: 'Dr. Emily Davis',
      specialization: 'Oncology',
      email: 'emily.davis@astramind.com',
      phone: '+1 (555) 888-1005',
      isActive: true,
      consultationFee: 250.0,
      experienceYears: 20,
      qualification: 'MD, FACP',
      profileImage: 'https://i.pravatar.cc/150?u=emily',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTimeSlots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'],
    },
    {
      id: 'seed-doctor-006',
      name: 'Dr. David Wilson',
      specialization: 'Neurology',
      email: 'david.wilson@astramind.com',
      phone: '+1 (555) 888-1006',
      isActive: true,
      consultationFee: 220.0,
      experienceYears: 18,
      qualification: 'MD, FAAN',
      profileImage: 'https://i.pravatar.cc/150?u=david',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTimeSlots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'],
    },
    {
      id: 'seed-doctor-007',
      name: 'Dr. Jennifer Brown',
      specialization: 'Gynecology',
      email: 'jennifer.brown@astramind.com',
      phone: '+1 (555) 888-1007',
      isActive: true,
      consultationFee: 160.0,
      experienceYears: 14,
      qualification: 'MD, FACOG',
      profileImage: 'https://i.pravatar.cc/150?u=jennifer',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTimeSlots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'],
    },
    {
      id: 'seed-doctor-008',
      name: 'Dr. James Anderson',
      specialization: 'General Medicine',
      email: 'james.anderson@astramind.com',
      phone: '+1 (555) 888-1008',
      isActive: true,
      consultationFee: 100.0,
      experienceYears: 25,
      qualification: 'MD, FACP',
      profileImage: 'https://i.pravatar.cc/150?u=james',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTimeSlots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'],
    },
    {
      id: 'seed-doctor-009',
      name: 'Dr. Sophia Martinez',
      specialization: 'ENT',
      email: 'sophia.martinez@astramind.com',
      phone: '+1 (555) 888-1009',
      isActive: true,
      consultationFee: 140.0,
      experienceYears: 9,
      qualification: 'MD, FACS',
      profileImage: 'https://i.pravatar.cc/150?u=sophia',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTimeSlots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'],
    },
    {
      id: 'seed-doctor-010',
      name: 'Dr. William Taylor',
      specialization: 'Ophthalmology',
      email: 'william.taylor@astramind.com',
      phone: '+1 (555) 888-1010',
      isActive: true,
      consultationFee: 175.0,
      experienceYears: 16,
      qualification: 'MD, FAAO',
      profileImage: 'https://i.pravatar.cc/150?u=william',
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTimeSlots: ['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'],
    },
  ];

  const doctors: typeof doctorsData = [];
  for (const docData of doctorsData) {
    const doc = await prisma.doctor.upsert({
      where: { id: docData.id },
      update: { 
        name: docData.name,
        specialization: docData.specialization,
        email: docData.email,
        phone: docData.phone,
        isActive: docData.isActive,
        consultationFee: docData.consultationFee,
        experienceYears: docData.experienceYears,
        qualification: docData.qualification,
        profileImage: docData.profileImage,
        availableDays: docData.availableDays,
        availableTimeSlots: docData.availableTimeSlots,
      },
      create: {
        ...docData,
        hospitalId: hospital.id,
      },
    });
    doctors.push(doc as any);
    console.log(`✅ Doctor: ${doc.name} (${doc.specialization})`);
  }

  // ── 3. Create Patients ───────────────────────────────────────────────────────
  const patientsData = [
    { id: 'seed-patient-001', name: 'Alice Nguyen', phone: '+15550001001', email: 'alice@example.com' },
    { id: 'seed-patient-002', name: 'Bob Martinez', phone: '+15550001002', email: 'bob@example.com' },
    { id: 'seed-patient-003', name: 'Carol Simmons', phone: '+15550001003', email: null },
    { id: 'seed-patient-004', name: 'David Brown', phone: '+15550001004', email: 'david@example.com' },
    { id: 'seed-patient-005', name: 'Eve Thompson', phone: '+15550001005', email: null },
    { id: 'seed-patient-006', name: 'Frank Lee', phone: '+15550001006', email: 'frank@example.com' },
  ];

  for (const patData of patientsData) {
    const patient = await prisma.patient.upsert({
      where: { hospitalId_phone: { hospitalId: hospital.id, phone: patData.phone } },
      update: {},
      create: {
        ...patData,
        hospitalId: hospital.id,
      },
    });
    console.log(`✅ Patient: ${patient.name}`);
  }

  const patients = await prisma.patient.findMany({ where: { hospitalId: hospital.id } });

  // ── 4. Create Appointments ───────────────────────────────────────────────────
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const appointmentsData = [
    // Today's appointments for Dr. Robert Smith
    {
      id: 'seed-appt-001',
      doctorId: 'seed-doctor-001',
      patientId: patients[0].id,
      dateTime: new Date(today.getTime() + 9 * 3600 * 1000),  // 9:00 AM today
      status: AppointmentStatus.CONFIRMED,
      notes: 'Annual cardiac checkup',
    },
    {
      id: 'seed-appt-002',
      doctorId: 'seed-doctor-001',
      patientId: patients[1].id,
      dateTime: new Date(today.getTime() + 10 * 3600 * 1000), // 10:00 AM today
      status: AppointmentStatus.CONFIRMED,
      notes: 'Follow-up for hypertension',
    },
    {
      id: 'seed-appt-003',
      doctorId: 'seed-doctor-001',
      patientId: patients[2].id,
      dateTime: new Date(today.getTime() + 11 * 3600 * 1000), // 11:00 AM today
      status: AppointmentStatus.PENDING,
      notes: null,
    },

    // Today's appointments for Dr. Amanda Ross
    {
      id: 'seed-appt-004',
      doctorId: 'seed-doctor-002',
      patientId: patients[3].id,
      dateTime: new Date(today.getTime() + 9.5 * 3600 * 1000), // 9:30 AM today
      status: AppointmentStatus.CONFIRMED,
      notes: 'Child wellness visit',
    },
    {
      id: 'seed-appt-005',
      doctorId: 'seed-doctor-002',
      patientId: patients[4].id,
      dateTime: new Date(today.getTime() + 13 * 3600 * 1000), // 1:00 PM today
      status: AppointmentStatus.RESCHEDULED,
      notes: 'Rescheduled from last week',
    },

    // Future appointments
    {
      id: 'seed-appt-006',
      doctorId: 'seed-doctor-004',
      patientId: patients[5].id,
      dateTime: new Date(today.getTime() + 24 * 3600 * 1000 + 10 * 3600 * 1000), // Tomorrow 10 AM
      status: AppointmentStatus.CONFIRMED,
      notes: 'Post-surgery follow-up',
    },
    {
      id: 'seed-appt-007',
      doctorId: 'seed-doctor-005',
      patientId: patients[0].id,
      dateTime: new Date(today.getTime() + 48 * 3600 * 1000 + 14 * 3600 * 1000), // Day after tomorrow 2 PM
      status: AppointmentStatus.PENDING,
      notes: null,
    },

    // Cancelled appointment example
    {
      id: 'seed-appt-008',
      doctorId: 'seed-doctor-001',
      patientId: patients[5].id,
      dateTime: new Date(today.getTime() + 14 * 3600 * 1000), // 2 PM today
      status: AppointmentStatus.CANCELLED,
      notes: 'Patient cancelled',
    },
  ];

  for (const apptData of appointmentsData) {
    await prisma.appointment.upsert({
      where: { id: apptData.id },
      update: { status: apptData.status },
      create: {
        ...apptData,
        hospitalId: hospital.id,
        duration: 30,
      },
    });
  }
  console.log(`✅ Created ${appointmentsData.length} sample appointments`);

  // ── 5. Create Knowledge Base Articles ────────────────────────────────────────
  const kbArticles = [
    { category: 'Hours', question: 'What are your hospital hours?', answer: 'AstraMind General Hospital is open Monday through Friday, 8:00 AM to 8:00 PM. Emergency services are available 24/7.' },
    { category: 'Parking', question: 'Where can I park?', answer: 'Free parking is available in Lot A and Lot B adjacent to the main building. Valet parking is available at the main entrance for $10.' },
    { category: 'Insurance', question: 'Do you accept insurance?', answer: 'We accept most major insurance providers including Blue Cross, Aetna, Cigna, United Health, and Medicare/Medicaid.' },
    { category: 'Billing', question: 'How do I pay my bill?', answer: 'You can pay online at our patient portal, by phone at +1 (555) 800-0001, or in person at the billing office on Floor 1.' },
    { category: 'Emergency', question: 'What is your emergency number?', answer: 'For life-threatening emergencies, call 911. Our ER direct line is +1 (555) 800-0911, open 24 hours a day.' },
    { category: 'Visiting', question: 'What are visiting hours?', answer: 'Visiting hours are 10:00 AM to 8:00 PM daily. ICU visits are limited to immediate family from 1:00 PM to 3:00 PM.' },
    { category: 'Contact', question: 'What is your main phone number?', answer: 'Our main reception line is +1 (555) 800-0000. We also offer a callback option if lines are busy.' },
    { category: 'Departments', question: 'What departments do you have?', answer: 'Our departments include Cardiology, Pediatrics, Neurology, Orthopedics, Dermatology, Oncology, Gastroenterology, and Endocrinology.' },
  ];

  for (const article of kbArticles) {
    await prisma.knowledgeBaseArticle.upsert({
      where: { id: `seed-kb-${article.category.toLowerCase()}` },
      update: {},
      create: {
        id: `seed-kb-${article.category.toLowerCase()}`,
        ...article,
        hospitalId: hospital.id,
        isActive: true,
      },
    });
  }
  console.log(`✅ Created ${kbArticles.length} knowledge base articles`);

  console.log('\n🎉 Database seeded successfully!');
  console.log(`   Hospital: ${hospital.name}`);
  console.log(`   Hospital ID: ${hospital.id}`);
  console.log(`   Doctors: ${doctorsData.length}`);
  console.log(`   Patients: ${patientsData.length}`);
  console.log(`   Appointments: ${appointmentsData.length}`);
  console.log(`   KB Articles: ${kbArticles.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
