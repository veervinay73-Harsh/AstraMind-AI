import dotenv from 'dotenv';
import prisma from '../src/config/prisma';
import { queryKnowledgeBase } from '../src/services/kbEngine';

dotenv.config();

async function runKBTest() {
  console.log("🤖 Starting Hospital Knowledge Base (FAQ) Engine Verification Test...\n");

  let hospitalA: any = null;
  let hospitalB: any = null;

  try {
    // 1. Setup mock data
    console.log("📦 Provisioning temporary multi-tenant FAQ data in database...");
    
    // Hospital A
    hospitalA = await prisma.hospital.create({
      data: {
        name: "AstraMind General",
        address: "123 Astra St",
        phone: "+15550001111",
      }
    });

    await prisma.knowledgeBaseArticle.createMany({
      data: [
        {
          category: "Timings",
          question: "What are the hospital timings?",
          answer: "AstraMind General is open 24/7.",
          hospitalId: hospitalA.id,
        },
        {
          category: "Parking",
          question: "Is there parking available?",
          answer: "Yes, parking is free for patients in the basement level.",
          hospitalId: hospitalA.id,
        }
      ]
    });

    // Hospital B (Tenant Isolation Test Partner)
    hospitalB = await prisma.hospital.create({
      data: {
        name: "Crossroad Hospital",
        address: "999 Crossroad Rd",
        phone: "+15559998888",
      }
    });

    await prisma.knowledgeBaseArticle.createMany({
      data: [
        {
          category: "Timings",
          question: "What are the hospital timings?",
          answer: "Crossroad Hospital is open from 8:00 AM to 8:00 PM.",
          hospitalId: hospitalB.id,
        },
        {
          category: "Insurance",
          question: "Do you accept insurance?",
          answer: "We accept major insurance plans including BlueShield and Medicare.",
          hospitalId: hospitalB.id,
        }
      ]
    });

    console.log("✅ Temporary FAQ data successfully provisioned.");

    // --- Scenario 1: Exact Question Match ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 1: Exact Question Match (Hospital A)");
    console.log("--------------------------------------------------");
    const resultExact = await queryKnowledgeBase(hospitalA.id, "What are the hospital timings?");
    console.log("Result:", JSON.stringify(resultExact, null, 2));

    if (resultExact.status === "ANSWER_FOUND" && resultExact.answer?.includes("24/7")) {
      console.log("Scenario 1 Status: ✅ PASS");
    } else {
      console.log("Scenario 1 Status: ❌ FAIL");
    }

    // --- Scenario 2: Similar Wording ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 2: Similar Wording (Hospital A)");
    console.log("--------------------------------------------------");
    const resultSimilar = await queryKnowledgeBase(hospitalA.id, "where can I park my car?");
    console.log("Result:", JSON.stringify(resultSimilar, null, 2));

    if (resultSimilar.status === "ANSWER_FOUND" && resultSimilar.answer?.includes("basement")) {
      console.log("Scenario 2 Status: ✅ PASS");
    } else {
      console.log("Scenario 2 Status: ❌ FAIL");
    }

    // --- Scenario 3: Unknown Question ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 3: Unknown Question (Hospital A)");
    console.log("--------------------------------------------------");
    const resultUnknown = await queryKnowledgeBase(hospitalA.id, "Can I buy pizza inside the clinic?");
    console.log("Result:", JSON.stringify(resultUnknown, null, 2));

    if (resultUnknown.status === "UNKNOWN") {
      console.log("Scenario 3 Status: ✅ PASS");
    } else {
      console.log("Scenario 3 Status: ❌ FAIL");
    }

    // --- Scenario 4: Tenant Isolation ---
    console.log("\n--------------------------------------------------");
    console.log("🧪 Running Scenario 4: Tenant Isolation (Hospital B)");
    console.log("--------------------------------------------------");
    // Ask the same timings question but to Hospital B
    const resultTenant = await queryKnowledgeBase(hospitalB.id, "What time do you guys open?");
    console.log("Result:", JSON.stringify(resultTenant, null, 2));

    if (resultTenant.status === "ANSWER_FOUND" && resultTenant.answer?.includes("8:00 AM to 8:00 PM")) {
      console.log("Scenario 4 Status: ✅ PASS");
    } else {
      console.log("Scenario 4 Status: ❌ FAIL");
    }

  } catch (error) {
    console.error("❌ Test script crashed with error:", error);
  } finally {
    // 2. Clean up mock database records
    console.log("\n🧹 Cleaning up temporary test data from database...");
    
    if (hospitalA) {
      await prisma.knowledgeBaseArticle.deleteMany({ where: { hospitalId: hospitalA.id } }).catch(() => {});
      await prisma.hospital.delete({ where: { id: hospitalA.id } }).catch(() => {});
    }

    if (hospitalB) {
      await prisma.knowledgeBaseArticle.deleteMany({ where: { hospitalId: hospitalB.id } }).catch(() => {});
      await prisma.hospital.delete({ where: { id: hospitalB.id } }).catch(() => {});
    }

    console.log("🧹 Cleanup complete.");
    process.exit(0);
  }
}

runKBTest();
