import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
let firebaseApp = null;

const initializeFirebase = () => {
  if (!firebaseApp) {
    try {
      // Check if Firebase credentials are provided
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
        console.warn('Firebase credentials not found. FCM notifications will be disabled.');
        return null;
      }

      // Parse private key (replace \\n with actual newlines)
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: privateKey,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });

      console.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('Error initializing Firebase Admin SDK:', error);
      return null;
    }
  }
  return firebaseApp;
};

// Send notification to a single device
export const sendNotificationToDevice = async (deviceToken, notification) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      console.warn('Firebase not initialized. Cannot send notification.');
      return { success: false, error: 'Firebase not initialized' };
    }

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
    
    // Handle invalid token errors
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      console.warn('Invalid or unregistered device token:', deviceToken);
      return { success: false, error: 'Invalid device token', shouldRemoveToken: true };
    }
    
    return { success: false, error: error.message };
  }
};

// Send notification to multiple devices
export const sendNotificationToMultipleDevices = async (deviceTokens, notification) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      console.warn('Firebase not initialized. Cannot send notification.');
      return { success: false, error: 'Firebase not initialized' };
    }

    // Filter out invalid tokens
    const validTokens = deviceTokens.filter(token => token && token.trim() !== '');
    
    if (validTokens.length === 0) {
      return { success: false, error: 'No valid device tokens provided' };
    }

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
    
    // Handle failed tokens
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
      failedTokens: failedTokens
    };

  } catch (error) {
    console.error('Error sending notification to multiple devices:', error);
    return { success: false, error: error.message };
  }
};

// Send notification to a topic
export const sendNotificationToTopic = async (topic, notification) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      console.warn('Firebase not initialized. Cannot send notification.');
      return { success: false, error: 'Firebase not initialized' };
    }

    const message = {
      topic: topic,
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

// Subscribe device to a topic
export const subscribeDeviceToTopic = async (deviceToken, topic) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      console.warn('Firebase not initialized. Cannot subscribe to topic.');
      return { success: false, error: 'Firebase not initialized' };
    }

    const response = await admin.messaging().subscribeToTopic([deviceToken], topic);
    console.log(`Successfully subscribed device to topic: ${topic}`);
    return { success: true, response };

  } catch (error) {
    console.error('Error subscribing device to topic:', error);
    return { success: false, error: error.message };
  }
};

// Unsubscribe device from a topic
export const unsubscribeDeviceFromTopic = async (deviceToken, topic) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      console.warn('Firebase not initialized. Cannot unsubscribe from topic.');
      return { success: false, error: 'Firebase not initialized' };
    }

    const response = await admin.messaging().unsubscribeFromTopic([deviceToken], topic);
    console.log(`Successfully unsubscribed device from topic: ${topic}`);
    return { success: true, response };

  } catch (error) {
    console.error('Error unsubscribing device from topic:', error);
    return { success: false, error: error.message };
  }
};

// Validate device token
export const validateDeviceToken = async (deviceToken) => {
  try {
    const app = initializeFirebase();
    if (!app) {
      return { valid: false, error: 'Firebase not initialized' };
    }

    // Try to send a test message (this will validate the token)
    const testMessage = {
      token: deviceToken,
      data: {
        test: 'true'
      }
    };

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

// Notification templates for different types
export const notificationTemplates = {
  appointment_reminder: {
    title: 'Appointment Reminder',
    body: 'Your appointment is coming up soon!',
    icon: 'ic_appointment',
    sound: 'default'
  },
  appointment_confirmed: {
    title: 'Appointment Confirmed',
    body: 'Your appointment has been confirmed.',
    icon: 'ic_check',
    sound: 'default'
  },
  appointment_cancelled: {
    title: 'Appointment Cancelled',
    body: 'Your appointment has been cancelled.',
    icon: 'ic_cancel',
    sound: 'default'
  },
  promotion: {
    title: 'Special Offer',
    body: 'Check out our latest promotions!',
    icon: 'ic_promotion',
    sound: 'default'
  },
  clinic_update: {
    title: 'Clinic Update',
    body: 'Important update from your clinic.',
    icon: 'ic_clinic',
    sound: 'default'
  },
  loyalty_points: {
    title: 'Loyalty Points',
    body: 'You have earned loyalty points!',
    icon: 'ic_points',
    sound: 'default'
  },
  treatment_available: {
    title: 'New Treatment Available',
    body: 'A new treatment is now available at your clinic.',
    icon: 'ic_treatment',
    sound: 'default'
  },
  general: {
    title: 'SkinSync Notification',
    body: 'You have a new notification.',
    icon: 'ic_notification',
    sound: 'default'
  }
};

export default {
  sendNotificationToDevice,
  sendNotificationToMultipleDevices,
  sendNotificationToTopic,
  subscribeDeviceToTopic,
  unsubscribeDeviceFromTopic,
  validateDeviceToken,
  notificationTemplates
};
