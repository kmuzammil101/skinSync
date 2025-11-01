import admin from 'firebase-admin';
import Notification from '../models/Notification.js';
import Clinic from '../models/Clinic.js'; // Your Clinic model

// 1. Check if clinic notifications are enabled
const checkClinicNotificationEnabled = async (clinicId) => {
  const clinic = await Clinic.findById(clinicId).select("notificationsEnabled deviceToken");
  if (!clinic) throw new Error("Clinic not found");
  return { enabled: clinic.notificationsEnabled, deviceTokens: clinic.deviceToken || [] };
};

// 2. Send notification to clinic devices and save to DB
export const sendNotificationToClinicAndSave = async (clinicId, notificationData) => {
  try {
    const { enabled, deviceTokens } = await checkClinicNotificationEnabled(clinicId);
    if (!enabled) {
      console.log(`⚠️ Notifications are turned off for clinic ${clinicId}`);
      return { success: false, message: "Notifications are turned off for this clinic." };
    }

    // Create notification document in MongoDB
    // Note: Notification model requires userId, but for clinic-only notifications,
    // we can pass a dummy userId or update the model. For now, using clinicId as userId reference.
    // In appointment context, we'll always have userId from the appointment
    const newNotification = await Notification.create({
      userId: notificationData.userId || clinicId, // Use clinicId as fallback if no userId provided
      clinicId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || 'general',
      metadata: notificationData.metadata || {},
      scheduledFor: notificationData.scheduledFor || Date.now(),
    });

    if (!deviceTokens.length) {
      console.warn('⚠️ No device tokens found for clinic.');
      return { success: true, notification: newNotification, message: 'No device tokens to send to.' };
    }

    const baseMessage = {
      data: { 
        title: newNotification.title, 
        body: newNotification.message, 
        type: newNotification.type, 
        notificationId: newNotification._id.toString(), 
        ...Object.fromEntries(Object.entries(newNotification.metadata || {}).map(([k, v]) => [String(k), String(v)])) 
      },
      android: { notification: { icon: 'ic_notification', color: '#667eea', sound: 'default', channelId: 'skinsync_notifications', priority: 'high' } },
      apns: { payload: { aps: { alert: { title: newNotification.title, body: newNotification.message }, badge: 1, sound: 'default', category: 'SKINSYNC_NOTIFICATION' } }, headers: { 'apns-priority': '10' } },
    };

    const responses = await Promise.allSettled(
      deviceTokens.map(async (token, idx) => {
        try {
          const message = { ...baseMessage, token };
          const response = await admin.messaging().send(message);
          console.log(`✅ Sent to token [${idx + 1}]: ${token}`);
          return { token, success: true, messageId: response };
        } catch (error) {
          console.error(`❌ Error sending to ${token}:`, error.message);
          const code = error.code || 'unknown';
          if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
            await Clinic.updateOne({ _id: clinicId }, { $pull: { deviceToken: token } });
          }
          return { token, success: false, error: code, errorMessage: error.message };
        }
      })
    );

    const successCount = responses.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedCount = responses.length - successCount;

    return { success: true, message: `Notification sent to ${successCount} devices, failed for ${failedCount}.`, notification: newNotification, results: responses };

  } catch (error) {
    console.error('❌ Error in sendNotificationToClinicAndSave:', error);
    return { success: false, error: error.message };
  }
};
