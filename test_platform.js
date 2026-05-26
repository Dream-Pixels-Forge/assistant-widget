// Test script for Platform Service
const platformService = require('./src/main/platformService');

console.log('=== Platform Service Test ===');

function testInitialization() {
  console.log('\n--- Testing Initialization ---');
  try {
    // platformService is already instantiated (singleton)
    console.log('✓ Platform Service imported successfully');
    
    // Check if methods exist
    console.log(`has initialize: ${typeof platformService.initialize === 'function'}`);
    console.log(`has createTray: ${typeof platformService.createTray === 'function'}`);
    console.log(`has registerGlobalHotkeys: ${typeof platformService.registerGlobalHotkeys === 'function'}`);
    console.log(`has cleanup: ${typeof platformService.cleanup === 'function'}`);
    
    return platformService;
  } catch (error) {
    console.error('✗ Error initializing Platform Service:', error);
    return null;
  }
}

function testMethods(platformService) {
  console.log('\n--- Testing Methods ---');
  try {
    // These methods should not throw errors even without a window
    platformService.createTray();
    console.log('✓ createTray executed without error');
    
    platformService.registerGlobalHotkeys();
    console.log('✓ registerGlobalHotkeys executed without error');
    
    platformService.updateHotkeys();
    console.log('✓ updateHotkeys executed without error');
    
    platformService.cleanup();
    console.log('✓ cleanup executed without error');
  } catch (error) {
    console.error('✗ Error testing methods:', error);
  }
}

function runAllTests() {
  try {
    const platformService = testInitialization();
    if (platformService) {
      testMethods(platformService);
    }
    console.log('\n✓ All platform service tests completed!');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
  }
}

runAllTests();