// Full test script for AI Service
const aiService = require('./src/main/aiService');

console.log('=== AI Service Full Test ===');

// Test rule-based responses
async function testRuleBasedResponses() {
  console.log('\n--- Testing Rule-Based Responses ---');
  
  const testCases = [
    { input: 'Hello, how are you?', type: 'general' },
    { input: 'Can you help me write an email?', type: 'writing' },
    { input: 'I need to prepare a presentation', type: 'speaking' },
    { input: 'How do I open Chrome?', type: 'command' },
    { input: 'I have a goal to learn Spanish', type: 'task' },
    { input: 'What can you do?', type: 'help' }
  ];
  
  for (const testCase of testCases) {
    console.log(`\nInput: "${testCase.input}"`);
    const response = await aiService.getResponse(testCase.input);
    console.log(`Response: ${response.substring(0, 100)}...`);
  }
}

// Test conversation history
async function testConversationHistory() {
  console.log('\n--- Testing Conversation History ---');
  
  await aiService.getResponse('Hello');
  await aiService.getResponse('How can I improve my writing?');
  
  console.log(`Conversation history length: ${aiService.conversationHistory.length}`);
  console.log('Last 2 entries:');
  aiService.conversationHistory.slice(-2).forEach((entry, index) => {
    console.log(`  ${index + 1}. ${entry.role}: ${entry.content.substring(0, 50)}...`);
  });
}

// Test history limit
async function testHistoryLimit() {
  console.log('\n--- Testing History Limit ---');
  
  // Add more than 20 messages
  for (let i = 0; i < 25; i++) {
    await aiService.getResponse(`Test message ${i}`);
  }
  
  console.log(`Conversation history after 25 messages: ${aiService.conversationHistory.length} (should be <= 20)`);
}

async function runAllTests() {
  try {
    await testRuleBasedResponses();
    await testConversationHistory();
    await testHistoryLimit();
    console.log('\n✓ All tests completed successfully!');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
  }
}

runAllTests();