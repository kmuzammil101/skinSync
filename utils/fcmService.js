import admin from './firebaseAdmin.js'; // use the single exported instance
import Notification from '../models/Notification.js';
import User from '../models/User.js';

export const sendNotificationToDeviceAndSave = async (userId, deviceTokens = [], notificationData) => {
  try {
    // Create notification document in MongoDB
    const newNotification = await Notification.create({
      userId,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || 'general',
      metadata: notificationData.metadata || {},
      scheduledFor: notificationData.scheduledFor || Date.now(),
    });

    if (!deviceTokens.length) {
      console.warn('⚠️ No device tokens found for user.');
      return { success: true, notification: newNotification, message: 'No device tokens to send to.' };
    }

    const baseMessage = {
      notification: { title: newNotification.title, body: newNotification.message },
      data: { type: newNotification.type, notificationId: newNotification._id.toString(), ...Object.fromEntries(Object.entries(newNotification.metadata || {}).map(([k, v]) => [String(k), String(v)])) },
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
            await User.updateOne({ _id: userId }, { $pull: { deviceToken: token } });
          }
          return { token, success: false, error: code, errorMessage: error.message };
        }
      })
    );

    const successCount = responses.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedCount = responses.length - successCount;

    return { success: true, message: `Notification sent to ${successCount} devices, failed for ${failedCount}.`, notification: newNotification, results: responses };

  } catch (error) {
    console.error('❌ Error in sendNotificationToDeviceAndSave:', error);
    return { success: false, error: error.message };
  }
};


// -----------------------
// 🔹 Send notification to a single device
// -----------------------
export const sendNotificationToDevice = async (deviceToken, notification) => {
  try {
    const message = {
      token: deviceToken,
      notification: {
        title: notification.title,
        body: notification.message,
      },
      data: {
        type: notification.type || 'general',
        notificationId: notification.notificationId || '',
        ...notification.metadata || {}
      },
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#667eea',
          sound: 'default',
          channelId: 'skinsync_notifications',
          priority: 'high',
        },
        data: {
          type: notification.type || 'general',
          notificationId: notification.notificationId || '',
          ...notification.metadata || {}
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.message,
            },
            badge: 1,
            sound: 'default',
            category: 'SKINSYNC_NOTIFICATION',
          },
        },
        headers: {
          'apns-priority': '10',
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent notification:', response);
    return { success: true, messageId: response };

  } catch (error) {
    console.error('Error sending notification to device:', error);

    if (error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered') {
      console.warn('Invalid or unregistered device token:', deviceToken);
      return { success: false, error: 'Invalid device token', shouldRemoveToken: true };
    }

    return { success: false, error: error.message };
  }
};

// -----------------------
// 🔹 Send notification to multiple devices
// -----------------------
export const sendNotificationToMultipleDevices = async (deviceTokens, notification) => {
  try {
    const validTokens = deviceTokens.filter(token => token && token.trim() !== '');
    if (!validTokens.length) return { success: false, error: 'No valid device tokens provided' };

    const message = {
      tokens: validTokens,
      notification: {
        title: notification.title,
        body: notification.message,
      },
      data: {
        type: notification.type || 'general',
        notificationId: notification.notificationId || '',
        ...notification.metadata || {}
      },
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#667eea',
          sound: 'default',
          channelId: 'skinsync_notifications',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.message,
            },
            badge: 1,
            sound: 'default',
            category: 'SKINSYNC_NOTIFICATION',
          },
        },
        headers: {
          'apns-priority': '10',
        },
      },
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log(`Successfully sent notification to ${response.successCount} devices`);
    console.log(`Failed to send to ${response.failureCount} devices`);

    const failedTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        console.error(`Failed to send to token ${validTokens[idx]}:`, resp.error);
        if (resp.error?.code === 'messaging/invalid-registration-token' ||
          resp.error?.code === 'messaging/registration-token-not-registered') {
          failedTokens.push(validTokens[idx]);
        }
      }
    });

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens
    };

  } catch (error) {
    console.error('Error sending notification to multiple devices:', error);
    return { success: false, error: error.message };
  }
};

// -----------------------
// 🔹 Send notification to a topic
// -----------------------
export const sendNotificationToTopic = async (topic, notification) => {
  try {
    const message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.message,
      },
      data: {
        type: notification.type || 'general',
        notificationId: notification.notificationId || '',
        ...notification.metadata || {}
      },
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#667eea',
          sound: 'default',
          channelId: 'skinsync_notifications',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: notification.title,
              body: notification.message,
            },
            badge: 1,
            sound: 'default',
            category: 'SKINSYNC_NOTIFICATION',
          },
        },
        headers: {
          'apns-priority': '10',
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent notification to topic:', topic);
    return { success: true, messageId: response };

  } catch (error) {
    console.error('Error sending notification to topic:', error);
    return { success: false, error: error.message };
  }
};

// -----------------------
// 🔹 Subscribe / Unsubscribe device to/from topic
// -----------------------
export const subscribeDeviceToTopic = async (deviceToken, topic) => {
  try {
    const response = await admin.messaging().subscribeToTopic([deviceToken], topic);
    console.log(`Successfully subscribed device to topic: ${topic}`);
    return { success: true, response };
  } catch (error) {
    console.error('Error subscribing device to topic:', error);
    return { success: false, error: error.message };
  }
};

export const unsubscribeDeviceFromTopic = async (deviceToken, topic) => {
  try {
    const response = await admin.messaging().unsubscribeFromTopic([deviceToken], topic);
    console.log(`Successfully unsubscribed device from topic: ${topic}`);
    return { success: true, response };
  } catch (error) {
    console.error('Error unsubscribing device from topic:', error);
    return { success: false, error: error.message };
  }
};

// -----------------------
// 🔹 Validate device token
// -----------------------
export const validateDeviceToken = async (deviceToken) => {
  try {
    const testMessage = { token: deviceToken, data: { test: 'true' } };
    await admin.messaging().send(testMessage);
    return { valid: true };
  } catch (error) {
    if (error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered') {
      return { valid: false, error: 'Invalid or unregistered token' };
    }
    return { valid: false, error: error.message };
  }
};

// -----------------------
// 🔹 Notification templates
// -----------------------
export const notificationTemplates = {
  appointment_reminder: { title: 'Appointment Reminder', body: 'Your appointment is coming up soon!', icon: 'ic_appointment', sound: 'default' },
  appointment_confirmed: { title: 'Appointment Confirmed', body: 'Your appointment has been confirmed.', icon: 'ic_check', sound: 'default' },
  appointment_cancelled: { title: 'Appointment Cancelled', body: 'Your appointment has been cancelled.', icon: 'ic_cancel', sound: 'default' },
  promotion: { title: 'Special Offer', body: 'Check out our latest promotions!', icon: 'ic_promotion', sound: 'default' },
  clinic_update: { title: 'Clinic Update', body: 'Important update from your clinic.', icon: 'ic_clinic', sound: 'default' },
  loyalty_points: { title: 'Loyalty Points', body: 'You have earned loyalty points!', icon: 'ic_points', sound: 'default' },
  treatment_available: { title: 'New Treatment Available', body: 'A new treatment is now available at your clinic.', icon: 'ic_treatment', sound: 'default' },
  general: { title: 'SkinSync Notification', body: 'You have a new notification.', icon: 'ic_notification', sound: 'default' }
};

// -----------------------
// 🔹 Default export
// -----------------------
export default {
  sendNotificationToDevice,
  sendNotificationToMultipleDevices,
  sendNotificationToTopic,
  subscribeDeviceToTopic,
  unsubscribeDeviceFromTopic,
  validateDeviceToken,
  notificationTemplates
};
