import { processConversationTurn, clearSessionState } from './src/services/stateManager';
import prisma from './src/config/prisma';

async function run() {
  console.log("=== Running Scenario 1: Book with doctor name ===");
  clearSessionState('test1');
  await processConversationTurn('test1', 'Hello');
  await processConversationTurn('test1', 'My name is Alice');
  await processConversationTurn('test1', 'My number is 555-0100');
  await processConversationTurn('test1', 'I want to see Dr. Robert Smith');
  await processConversationTurn('test1', 'Tomorrow');
  const state1 = await processConversationTurn('test1', '10 AM');
  console.log("Scenario 1 Final State:", state1.state, state1.missing_fields);

  console.log("\n=== Running Scenario 2: Book with specialization ===");
  clearSessionState('test2');
  await processConversationTurn('test2', 'My name is Bob');
  await processConversationTurn('test2', '555-0200');
  const state2_spec = await processConversationTurn('test2', 'I need a cardiologist');
  console.log("Scenario 2 Specialization State:", state2_spec.recommended_doctors);
  await processConversationTurn('test2', 'Dr. Robert Smith is fine');
  await processConversationTurn('test2', 'Next Monday');
  const state2 = await processConversationTurn('test2', '2 PM');
  console.log("Scenario 2 Final State:", state2.state, state2.missing_fields);

  console.log("\n=== Running Scenario 3: Say 'Yes' ===");
  clearSessionState('test3');
  await processConversationTurn('test3', 'My name is Charlie');
  await processConversationTurn('test3', '555-0300');
  await processConversationTurn('test3', 'Dr. Amanda Ross');
  await processConversationTurn('test3', 'Friday');
  await processConversationTurn('test3', '9 AM');
  const state3 = await processConversationTurn('test3', 'Yes confirm it');
  console.log("Scenario 3 Final Intent & State:", state3.intent, state3.state);

  console.log("\n=== Running Scenario 4: Say 'No' ===");
  clearSessionState('test4');
  await processConversationTurn('test4', 'My name is Dave');
  await processConversationTurn('test4', '555-0400');
  await processConversationTurn('test4', 'Dr. Amanda Ross');
  await processConversationTurn('test4', 'Friday');
  await processConversationTurn('test4', '9 AM');
  const state4 = await processConversationTurn('test4', 'Actually no cancel it');
  console.log("Scenario 4 Final Intent & State:", state4.intent, state4.state);

  console.log("\n=== Running Scenario 5: Change doctor midway ===");
  clearSessionState('test5');
  await processConversationTurn('test5', 'My name is Eve');
  await processConversationTurn('test5', '555-0500');
  await processConversationTurn('test5', 'Dr. Robert Smith');
  const state5_mid = await processConversationTurn('test5', 'Actually switch me to Dr. Amanda Ross');
  console.log("Scenario 5 Mid Doctor:", state5_mid.doctor);

  console.log("\n=== Running Scenario 6: Change date midway ===");
  clearSessionState('test6');
  await processConversationTurn('test6', 'My name is Frank');
  await processConversationTurn('test6', '555-0600');
  await processConversationTurn('test6', 'Dr. Robert Smith');
  await processConversationTurn('test6', 'Monday');
  const state6_mid = await processConversationTurn('test6', 'Wait change date to Tuesday');
  console.log("Scenario 6 Mid Date:", state6_mid.date);
}

run().catch(console.error).finally(() => prisma.$disconnect());
