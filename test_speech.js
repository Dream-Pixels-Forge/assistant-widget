// Test script for Speech Service
const SpeechService = require('./src/main/speechService');

console.log('=== Speech Service Test ===');

async function testInitialization() {
  console.log('\n--- Testing Initialization ---');
  try {
    const speechService = new SpeechService();
    console.log('✓ Speech Service initialized successfully');
    
    // Check if properties are set
    console.log(`Whisper.cpp path: ${speechService.whisperCppPath}`);
    console.log(`Main executable: ${speechService.whisperMain}`);
    console.log(`Model path: ${speechService.modelPath}`);
    
    // Check if methods exist
    console.log(`has startListening: ${typeof speechService.startListening === 'function'}`);
    console.log(`has stopListening: ${typeof speechService.stopListening === 'function'}`);
    console.log(`has speakText: ${typeof speechService.speakText === 'function'}`);
    
    return speechService;
  } catch (error) {
    console.error('✗ Error initializing Speech Service:', error);
    return null;
  }
}

async function testWhisperReadiness(speechService) {
  console.log('\n--- Testing Whisper Readiness ---');
  try {
    const isReady = await speechService.isWhisperReady();
    console.log(`Whisper ready: ${isReady}`);
    if (!isReady) {
      console.log('This is expected if the model is not downloaded or whisper.cpp is not built.');
    }
  } catch (error) {
    console.error('✗ Error checking Whisper readiness:', error);
  }
}

async testSpeakText(speechService) {
  console.log('\n--- Testing Speak Text ---');
  try {
    const result = await speechService.speakText('Hello, this is a test.');
    console.log(`Speak text result: ${JSON.stringify(result)}`);
  } catch (error) {
    console.error('✗ Error in speakText:', error);
  }
}

async function runAllTests() {
  try {
    const speechService = await testInitialization();
    if (speechService) {
      await testWhisperReadiness(speechService);
      await testSpeakText(speechService);
    }
    console.log('\n✓ All speech service tests completed!');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
  }
}

runAllTests();