import admin from 'firebase-admin';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import path from "path";
import fs from "fs";
// ✅ Safely load JSON file manually instead of ESM import (works in all Node versions)
const __dirname = path.resolve();
const serviceAccountPath = path.join(__dirname, './skinsync-2aa8e-firebase-adminsdk-fbsvc-5f2fdd2a8b.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

// -------------------------------------------------------------
// 🔹 Initialize Firebase Admin SDK (Singleton pattern)
// -------------------------------------------------------------
let firebaseApp;

export const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    try {
      console.log("Attempting to initialize Firebase for project:", serviceAccount.project_id);

      // ✅ FIX: Manually construct the credential, explicitly replacing escaped newlines.
      // This is often necessary when reading the JSON file directly.
      const certCredential = {
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        // The service account JSON file often has private_key with "\\n"
        // This regex ensures it's replaced with a literal newline character.
        privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
      };

      firebaseApp = admin.initializeApp({
        // Use admin.credential.cert with the manually formatted object
        credential: admin.credential.cert(certCredential),
        projectId: serviceAccount.project_id, // Redundant but good for clarity
      });

      // Log the credential type being used to verify the fix
      console.log('Credential Type:', firebaseApp.options_.credential.type); // Should show 'cert'
      console.log('✅ Firebase initialized successfully for project:', serviceAccount.project_id);
    } catch (error) {
      console.error('❌ Error initializing Firebase:', error.message);
      return null;
    }
  } else {
    firebaseApp = admin.app();
  }

  return firebaseApp;
};

// const initializeFirebase = () => {
//   if (!firebaseApp) {
//     try {
//       // Check if Firebase credentials are provided
//       if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
//         console.warn('Firebase credentials not found. FCM notifications will be disabled.');
//         return null;
//       }

//       // Parse private key (replace \\n with actual newlines)
//       const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

//       firebaseApp = admin.initializeApp({
//         credential: admin.credential.cert({
//           projectId: process.env.FIREBASE_PROJECT_ID,
//           privateKey: privateKey,
//           clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//         }),
//         projectId: process.env.FIREBASE_PROJECT_ID,
//       });

//       console.log('Firebase Admin SDK initialized successfully');
//     } catch (error) {
//       console.error('Error initializing Firebase Admin SDK:', error);
//       return null;
//     }
//   }
//   return firebaseApp;
// }

// -------------------------------------------------------------
// 🔹 Send notification + save to MongoDB
// -------------------------------------------------------------



export const sendNotificationToDeviceAndSave = async (userId, deviceTokens = [], notificationData) => {
  try {
    // Initialize Firebase (once)
    const app = initializeFirebase();
    console.log(app, ">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>appppppppappp")
    if (!app) {
      console.warn('⚠️ Firebase not initialized. Cannot send notification.');
      return { success: false, error: 'Firebase not initialized' };
    }

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
      notification: {
        title: newNotification.title,
        body: newNotification.message,
      },
      data: {
        type: newNotification.type,
        notificationId: newNotification._id.toString(),
        ...Object.fromEntries(
          Object.entries(newNotification.metadata || {}).map(([key, value]) => [String(key), String(value)])
        ),
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
              title: newNotification.title,
              body: newNotification.message,
            },
            badge: 1,
            sound: 'default',
            category: 'SKINSYNC_NOTIFICATION',
          },
        },
        headers: { 'apns-priority': '10' },
      },
    };

    console.log('📲 Sending notifications to device tokens:', deviceTokens);

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

          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            console.warn('⚠️ Removing invalid token from user:', token);
            await User.updateOne({ _id: userId }, { $pull: { deviceToken: token } });
          }

          return { token, success: false, error: code, errorMessage: error.message };
        }
      })
    );

    const successCount = responses.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failedCount = responses.length - successCount;

    return {
      success: true,
      message: `Notification sent to ${successCount} devices, failed for ${failedCount}.`,
      notification: newNotification,
      results: responses,
    };
  } catch (error) {
    console.error('❌ Error in sendNotificationToDeviceAndSave:', error);
    return { success: false, error: error.message };
  }
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
