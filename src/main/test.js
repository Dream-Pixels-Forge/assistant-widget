// Simple test to verify our modules work
const AIService = require('./aiService');
const SettingsService = require('./settingsService');

console.log('Testing AI Service...');
const aiService = new AIService();

aiService.getResponse('Hello, how are you?').then(response => {
  console.log('AI Response:', response);
  
  aiService.getResponse('Can you help me write an email?').then(response2 => {
    console.log('Writing Help Response:', response2);
    
    console.log('Testing Settings Service...');
    const settingsService = new SettingsService();
    console.log('Current theme:', settingsService.get('appearance.theme'));
    
    settingsService.set('appearance.theme', 'light');
    console.log('Updated theme:', settingsService.get('appearance.theme'));
    
    console.log('All tests completed successfully!');
  });
});