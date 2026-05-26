// Test script for AI Service
const aiService = require('./src/main/aiService');

console.log('Testing AI Service...');
try {
  // Check if OpenAI client was created
  if (aiService.openai) {
    console.log('✓ OpenAI client initialized');
  } else {
    console.log('ℹ OpenAI client not initialized (using rule-based fallback)');
  }
  
  // Check system prompt
  if (aiService.systemPrompt && aiService.systemPrompt.length > 0) {
    console.log('✓ System prompt set');
  } else {
    console.log('✗ System prompt not set');
  }
  
  console.log('✓ AI Service imported successfully');
  console.log('\nAI Service test completed.');
} catch (error) {
  console.error('✗ Error importing AI Service:', error);
}