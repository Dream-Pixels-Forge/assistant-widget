// Test script for Command Service
const commandService = require('./src/main/commandService');

console.log('=== Command Service Test ===');

async function testSafeExecute() {
  console.log('\n--- Testing Safe Execute ---');
  
  // Test safe commands
  const safeCommands = [
    'echo "Hello World"',
    'pwd',
    'ls -la',
    'mkdir -p test_dir',
    'touch test_file.txt'
  ];
  
  for (const cmd of safeCommands) {
    console.log(`\nExecuting: ${cmd}`);
    try {
      const result = await commandService.safeExecute(cmd);
      console.log(`Success: ${result.success}`);
      if (!result.success) {
        console.log(`Error: ${result.error}`);
      }
      if (result.stdout.trim()) {
        console.log(`Output: ${result.stdout.trim()}`);
      }
    } catch (error) {
      console.log(`Exception: ${error.message}`);
    }
  }
  
  // Clean up test files
  await commandService.execute('rm -rf test_dir test_file.txt');
}

async function testDangerousCommands() {
  console.log('\n--- Testing Dangerous Command Rejection ---');
  
  const dangerousCommands = [
    'rm -rf /',
    'dd if=/dev/zero of=/dev/sda',
    ':(){:|:&};:',  // Fork bomb
    'chmod -R 777 /',
    '> /etc/passwd'
  ];
  
  for (const cmd of dangerousCommands) {
    console.log(`\nTesting dangerous command: ${cmd}`);
    try {
      const result = await commandService.safeExecute(cmd);
      console.log(`Result: ${JSON.stringify(result)}`);
      // Should either fail or be rejected
    } catch (error) {
      console.log(`Caught error (expected): ${error.message}`);
    }
  }
}

async function testPlatformSpecific() {
  console.log('\n--- Testing Platform-Specific Functions ---');
  
  console.log(`Platform: ${process.platform}`);
  
  // Test launchApplication (will likely fail since we're not specifying real apps)
  // but we can see if the function executes without error
  try {
    const result = await commandService.launchApplication('nonexistentapp');
    console.log(`Launch application result: ${result.success}`);
  } catch (error) {
    console.log(`Launch application error (expected): ${error.message}`);
  }
  
  // Test openItem
  try {
    const result = await commandService.openItem('https://example.com');
    console.log(`Open item result: ${result.success}`);
  } catch (error) {
    console.log(`Open item error: ${error.message}`);
  }
}

async function runAllTests() {
  try {
    await testSafeExecute();
    await testDangerousCommands();
    await testPlatformSpecific();
    console.log('\n✓ All command service tests completed!');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
  }
}

runAllTests();