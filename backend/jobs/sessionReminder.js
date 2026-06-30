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

    const now = new Date();
    const in20Minutes = new Date(now.getTime() + 20 * 60 * 1000);

    // Fetch all scheduled, not-yet-reminded, reminders-enabled sessions.
    // We filter by combined date+time in JS because scheduledDate is stored
    // as midnight-only and scheduledTime is a separate "HH:MM" string.
    const candidates = await ScheduledSession.find({
      status: 'scheduled',
      enableReminders: true,
      reminderSent: { $ne: true }
    }).populate('teacher', 'name username');

    // Build the combined datetime and keep only those starting within 15 min
    const sessionsToRemind = candidates.filter(session => {
      if (!session.scheduledDate || !session.scheduledTime) return false;
      const dateStr = new Date(session.scheduledDate).toISOString().split('T')[0];
      const sessionDT = new Date(`${dateStr}T${session.scheduledTime}`);
      return sessionDT >= now && sessionDT <= in20Minutes;
    });

    if (sessionsToRemind.length === 0) {
      console.log('✅ No sessions starting within 15 minutes');
      return;
    }

    console.log(`📬 Found ${sessionsToRemind.length} session(s) needing reminders`);

    for (const session of sessionsToRemind) {
      try {
        const studentIds = session.registeredStudents.map(s => s.user);

        if (studentIds.length === 0) {
          console.log(`⚠️ No registered students for: ${session.sessionName}`);
          session.reminderSent = true;
          await session.save();
          continue;
        }

        console.log(`📨 Reminding ${studentIds.length} students about: ${session.sessionName}`);

        // Build enriched session object for the notification template
        const enrichedSession = {
          ...session.toObject(),
          teacherName: session.teacher?.name || session.teacher?.username || 'Teacher'
        };

        await Notification.notifySessionStartingSoon(enrichedSession, studentIds);

        session.reminderSent = true;
        await session.save();

        console.log(`✅ Reminders sent for: ${session.sessionName}`);

      } catch (sessionError) {
        console.error(`❌ Reminder error for session ${session._id}:`, sessionError.message);
      }
    }

    console.log('✅ Session reminder check complete');

  } catch (error) {
    console.error('❌ Session reminder job error:', error.message);
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