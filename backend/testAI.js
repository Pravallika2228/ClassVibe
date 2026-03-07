require('dotenv').config();
const { generator } = require('./services/aiQuizGenerator');
// In server.js or a test file
const { checkSessionReminders } = require('./jobs/sessionReminder');

// Run once to test
checkSessionReminders().then(() => {
  console.log('Test complete');
});

async function test() {
  try {
    console.log('Testing AI connection...');
    const result = await generator.testConnection();
    console.log(result);
    
    if (result.success) {
      console.log('\n✅ Generating sample quiz...');
      const quiz = await generator.generateFromText('Mathematics', 3);
      console.log(JSON.stringify(quiz, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Create a session that starts in 10 minutes (will trigger reminder)
const session = new ScheduledSession({
  sessionName: 'Test Session',
  scheduledDate: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
  duration: 60,
  createdBy: teacherId,
  allowedEmails: ['student@test.com'],
  registeredStudents: [{ user: studentId, registeredAt: new Date() }]
});
await session.save();

// Wait 5+ minutes, reminder should be sent

test();