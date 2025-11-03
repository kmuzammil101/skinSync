import cron from 'node-cron';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import Clinic from '../models/Clinic.js';
import Treatment from '../models/Treatment.js';
import { sendNotificationToDeviceAndSave } from './fcmService.js';
import { sendNotificationToClinicAndSave } from './fcmForClinic.js';

/**
 * Calculate days between two dates (ignoring time)
 */
const getDaysDifference = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d2 - d1;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Send appointment reminders daily with countdown (5 days, 4 days, 3 days, etc.)
 * Runs daily at 9:00 AM
 */
export const sendAppointmentReminders = async () => {
  try {
    console.log('🔄 Starting appointment reminder cron job...');
    
    // Get today's date at start of day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find appointments that are between today and 5 days from now
    // Only get confirmed/paid appointments that haven't been cancelled or completed
    const fiveDaysFromNow = new Date(today);
    console.log(fiveDaysFromNow)
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(23, 59, 59, 999);
    console.log(fiveDaysFromNow,">>>>>")

    const appointments = await Appointment.find({
      date: {
        $gte: today,
        $lte: fiveDaysFromNow
      },
      status: { $in: ['confirmed', 'paid'] },
      paymentStatus: { $in: ['paid', 'unpaid', 'processing'] }
    })
      .populate('userId', 'name deviceToken notificationsEnabled')
      .populate('clinicId', 'name deviceToken notificationsEnabled')
      .populate('treatmentId', 'name');

    if (!appointments || appointments.length === 0) {
      console.log('ℹ️ No appointments found for daily reminders.');
      return;
    }

    console.log(`📅 Found ${appointments.length} appointment(s) for daily reminders.`);

    let userNotificationsSent = 0;
    let clinicNotificationsSent = 0;
    let userErrors = 0;
    let clinicErrors = 0;

    // Process each appointment
    for (const appointment of appointments) {
      try {
        const appointmentDate = new Date(appointment.date);
        appointmentDate.setHours(0, 0, 0, 0);
        
        // Calculate days remaining
        const daysRemaining = getDaysDifference(today, appointmentDate);
        
        // Only send reminders if appointment is 1-5 days away
        if (daysRemaining < 0 || daysRemaining > 5) {
          continue;
        }

        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        // Prepare common data
        const treatmentName = appointment.treatmentId?.name || 'Treatment';
        const clinicName = appointment.clinicId?.name || 'Clinic';
        const userName = appointment.userId?.name || 'Patient';

        // Generate message based on days remaining
        let daysText;
        if (daysRemaining === 0) {
          daysText = 'today';
        } else if (daysRemaining === 1) {
          daysText = '1 day left';
        } else {
          daysText = `${daysRemaining} days left`;
        }

        const reminderTitle = daysRemaining === 0 
          ? 'Appointment Today!'
          : `Appointment Reminder - ${daysRemaining === 1 ? '1 Day' : `${daysRemaining} Days`} Remaining`;

        // Send notification to user
        if (appointment.userId && appointment.userId.notificationsEnabled !== false) {
          try {
            const userMessage = daysRemaining === 0
              ? `Your ${treatmentName} appointment at ${clinicName} is scheduled for ${formattedDate} at ${appointment.time}. It's today!`
              : `Reminder: Your ${treatmentName} appointment at ${clinicName} is scheduled for ${formattedDate} at ${appointment.time}. ${daysText.charAt(0).toUpperCase() + daysText.slice(1)}!`;

            await sendNotificationToDeviceAndSave(
              appointment.userId._id,
              {
                title: reminderTitle,
                message: userMessage,
                type: 'appointment_reminder',
                clinicId: appointment.clinicId?._id || null,
                metadata: {
                  appointmentId: appointment._id.toString(),
                  clinicId: appointment.clinicId?._id?.toString() || '',
                  treatmentId: appointment.treatmentId?._id?.toString() || '',
                  reminderType: `${daysRemaining}_days_before`,
                  daysRemaining: daysRemaining.toString()
                },
                scheduledFor: new Date()
              }
            );
            userNotificationsSent++;
            console.log(`✅ Sent reminder to user ${appointment.userId._id} for appointment ${appointment._id} (${daysText})`);
          } catch (userErr) {
            userErrors++;
            console.error(`❌ Error sending reminder to user ${appointment.userId._id}:`, userErr.message);
          }
        }

        // Send notification to clinic
        if (appointment.clinicId && appointment.clinicId.notificationsEnabled !== false) {
          try {
            const clinicMessage = daysRemaining === 0
              ? `Appointment with ${userName} for ${treatmentName} is scheduled for ${formattedDate} at ${appointment.time}. It's today!`
              : `Reminder: Appointment with ${userName} for ${treatmentName} is scheduled for ${formattedDate} at ${appointment.time}. ${daysText.charAt(0).toUpperCase() + daysText.slice(1)}!`;

            await sendNotificationToClinicAndSave(
              appointment.clinicId._id,
              {
                title: reminderTitle,
                message: clinicMessage,
                type: 'appointment_reminder',
                userId: appointment.userId._id, // Pass userId for Notification model requirement
                metadata: {
                  appointmentId: appointment._id.toString(),
                  userId: appointment.userId._id.toString(),
                  treatmentId: appointment.treatmentId?._id.toString() || '',
                  reminderType: `${daysRemaining}_days_before`,
                  daysRemaining: daysRemaining.toString()
                },
                scheduledFor: new Date()
              }
            );
            clinicNotificationsSent++;
            console.log(`✅ Sent reminder to clinic ${appointment.clinicId._id} for appointment ${appointment._id} (${daysText})`);
          } catch (clinicErr) {
            clinicErrors++;
            console.error(`❌ Error sending reminder to clinic ${appointment.clinicId._id}:`, clinicErr.message);
          }
        }
      } catch (appointmentErr) {
        console.error(`❌ Error processing appointment ${appointment._id}:`, appointmentErr.message);
      }
    }

    console.log(`📊 Reminder Summary:
      - User notifications sent: ${userNotificationsSent}
      - Clinic notifications sent: ${clinicNotificationsSent}
      - User errors: ${userErrors}
      - Clinic errors: ${clinicErrors}
    `);

  } catch (error) {
    console.error('❌ Error in appointment reminder cron job:', error);
  }
};

/**
 * Initialize and schedule cron jobs
 */
export const initializeCronJobs = () => {
  // Run daily at 9:00 AM
  // Cron format: minute hour day month weekday
  // '0 9 * * *' = Every day at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Appointment reminder cron job triggered at', new Date().toISOString());
    await sendAppointmentReminders();
  }, {
    scheduled: true,
    timezone: "UTC" // Adjust timezone as needed
  });

  console.log('✅ Cron jobs initialized - Appointment reminders will run daily at 9:00 AM UTC');
};

// Export for manual testing
export default {
  sendAppointmentReminders,
  initializeCronJobs
};

