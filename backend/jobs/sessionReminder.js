// backend/jobs/sessionReminder.js
// Automated Session Reminder System
// Checks every 5 minutes for sessions starting in 15 minutes

const ScheduledSession = require('../models/ScheduledSession');
const Notification = require('../models/Notification');

/**
 * Check for upcoming sessions and send reminders
 * Finds sessions starting in 15 minutes and notifies registered students
 */
async function checkSessionReminders() {
  try {
    console.log('🔔 Checking for upcoming session reminders...');
    
    // Calculate time window (now to 15 minutes from now)
    const now = new Date();
    const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);
    
    // Find sessions scheduled to start in the next 15 minutes
    const upcomingSessions = await ScheduledSession.find({
      status: 'scheduled',
      scheduledDate: {
        $gte: now,
        $lte: in15Minutes
      },
      // Only send reminder if we haven't already sent one
      reminderSent: { $ne: true }
    }).populate('createdBy', 'name username');
    
    if (upcomingSessions.length === 0) {
      console.log('✅ No upcoming sessions found');
      return;
    }
    
    console.log(`📬 Found ${upcomingSessions.length} upcoming session(s)`);
    
    // Send reminders for each session
    for (const session of upcomingSessions) {
      try {
        // Get student IDs from registered students
        const studentIds = session.registeredStudents.map(s => s.user);
        
        if (studentIds.length === 0) {
          console.log(`⚠️ No registered students for session: ${session.sessionName}`);
          continue;
        }
        
        console.log(`📨 Sending reminders to ${studentIds.length} students for: ${session.sessionName}`);
        
        // Send notification to all registered students
        await Notification.notifySessionStartingSoon(session, studentIds);
        
        // Mark reminder as sent to avoid duplicate notifications
        session.reminderSent = true;
        await session.save();
        
        console.log(`✅ Reminders sent for session: ${session.sessionName}`);
        
      } catch (sessionError) {
        console.error(`❌ Error sending reminder for session ${session._id}:`, sessionError);
      }
    }
    
    console.log('✅ Session reminder check complete');
    
  } catch (error) {
    console.error('❌ Session reminder error:', error);
  }
}

/**
 * Start the session reminder job
 * Runs every 5 minutes
 */
function startSessionReminderJob() {
  console.log('🚀 Session reminder job started (runs every 5 minutes)');
  
  // Run immediately on startup
  checkSessionReminders();
  
  // Then run every 5 minutes
  const intervalId = setInterval(checkSessionReminders, 5 * 60 * 1000);
  
  return intervalId;
}

/**
 * Stop the session reminder job
 * @param {NodeJS.Timeout} intervalId - The interval ID from startSessionReminderJob
 */
function stopSessionReminderJob(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
    console.log('🛑 Session reminder job stopped');
  }
}

module.exports = { 
  checkSessionReminders,
  startSessionReminderJob,
  stopSessionReminderJob
};