import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import { 
  sendNotificationToDevice, 
  sendNotificationToMultipleDevices,
  sendNotificationToTopic,
  notificationTemplates 
} from '../utils/fcmService.js';

// Get user notifications
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { 
      page = 1, 
      limit = 10, 
      type, 
      isRead, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      startDate,
      endDate
    } = req.query;

    const query = { userId };
    
    // Filter by type
    if (type) query.type = type;
    
    // Filter by read status
    if (isRead !== undefined) query.isRead = isRead === 'true';
    
    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const notifications = await Notification.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalNotifications: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Mark notification as read
export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Mark all notifications as read
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`
    });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get notification by ID
export const getNotificationById = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.userId;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Get notification by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get unread notifications count
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false
    });

    res.json({
      success: true,
      data: {
        unreadCount
      }
    });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get notifications by type
export const getNotificationsByType = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const notifications = await Notification.find({
      userId,
      type
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

    const total = await Notification.countDocuments({ userId, type });

    res.json({
      success: true,
      data: {
        notifications,
        type,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalNotifications: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get notifications by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create notification (admin function)
export const createNotification = async (req, res) => {
  try {
    const { userId, title, message, type, scheduledFor, metadata, sendPush = true } = req.body;

    const notification = new Notification({
      userId,
      title,
      message,
      type,
      scheduledFor: scheduledFor || new Date(),
      metadata: metadata || {}
    });

    await notification.save();

    // Send push notification if requested and user has device token
    if (sendPush) {
      try {
        const user = await User.findById(userId);
        if (user && user.deviceToken) {
          const fcmNotification = {
            title,
            message,
            type: type || 'general',
            notificationId: notification._id.toString(),
            metadata: metadata || {}
          };

          const fcmResult = await sendNotificationToDevice(user.deviceToken, fcmNotification);
          
          if (!fcmResult.success && fcmResult.shouldRemoveToken) {
            // Remove invalid device token
            await User.findByIdAndUpdate(userId, { deviceToken: null });
            console.log('Removed invalid device token for user:', userId);
          }
        }
      } catch (fcmError) {
        console.error('Error sending FCM notification:', fcmError);
        // Don't fail the entire request if FCM fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: notification
    });

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Create appointment reminder notification
export const createAppointmentReminder = async (req, res) => {
  try {
    const { appointmentId, reminderTime, sendPush = true } = req.body;
    const userId = req.user.userId;

    const appointment = await Appointment.findById(appointmentId)
      .populate('clinicId', 'name')
      .populate('treatmentId', 'name');

    if (!appointment || appointment.userId.toString() !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    const notification = new Notification({
      userId,
      title: 'Appointment Reminder',
      message: `Your ${appointment.treatmentId.name} appointment at ${appointment.clinicId.name} is scheduled for ${appointment.date.toDateString()} at ${appointment.time}`,
      type: 'appointment_reminder',
      scheduledFor: reminderTime || appointment.date,
      metadata: {
        appointmentId: appointment._id,
        clinicId: appointment.clinicId._id,
        treatmentId: appointment.treatmentId._id
      }
    });

    await notification.save();

    // Send push notification if requested
    if (sendPush) {
      try {
        const user = await User.findById(userId);
        if (user && user.deviceToken) {
          const fcmNotification = {
            title: 'Appointment Reminder',
            message: `Your ${appointment.treatmentId.name} appointment at ${appointment.clinicId.name} is scheduled for ${appointment.date.toDateString()} at ${appointment.time}`,
            type: 'appointment_reminder',
            notificationId: notification._id.toString(),
            metadata: {
              appointmentId: appointment._id.toString(),
              clinicId: appointment.clinicId._id.toString(),
              treatmentId: appointment.treatmentId._id.toString()
            }
          };

          const fcmResult = await sendNotificationToDevice(user.deviceToken, fcmNotification);
          
          if (!fcmResult.success && fcmResult.shouldRemoveToken) {
            await User.findByIdAndUpdate(userId, { deviceToken: null });
            console.log('Removed invalid device token for user:', userId);
          }
        }
      } catch (fcmError) {
        console.error('Error sending FCM appointment reminder:', fcmError);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Appointment reminder created successfully',
      data: notification
    });

  } catch (error) {
    console.error('Create appointment reminder error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete all notifications
export const deleteAllNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await Notification.deleteMany({ userId });

    res.json({
      success: true,
      message: `${result.deletedCount} notifications deleted successfully`
    });

  } catch (error) {
    console.error('Delete all notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Send notification to multiple users (admin function)
export const sendBulkNotification = async (req, res) => {
  try {
    const { userIds, title, message, type, metadata, sendPush = true } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs array is required'
      });
    }

    const notifications = [];
    const deviceTokens = [];

    // Create notifications for each user
    for (const userId of userIds) {
      const notification = new Notification({
        userId,
        title,
        message,
        type: type || 'general',
        scheduledFor: new Date(),
        metadata: metadata || {}
      });

      await notification.save();
      notifications.push(notification);

      // Collect device tokens for bulk push notification
      if (sendPush) {
        const user = await User.findById(userId);
        if (user && user.deviceToken) {
          deviceTokens.push(user.deviceToken);
        }
      }
    }

    // Send bulk push notification
    if (sendPush && deviceTokens.length > 0) {
      try {
        const fcmNotification = {
          title,
          message,
          type: type || 'general',
          metadata: metadata || {}
        };

        const fcmResult = await sendNotificationToMultipleDevices(deviceTokens, fcmNotification);
        console.log(`Bulk notification sent: ${fcmResult.successCount} successful, ${fcmResult.failureCount} failed`);

        // Remove invalid tokens
        if (fcmResult.failedTokens && fcmResult.failedTokens.length > 0) {
          await User.updateMany(
            { deviceToken: { $in: fcmResult.failedTokens } },
            { deviceToken: null }
          );
          console.log(`Removed ${fcmResult.failedTokens.length} invalid device tokens`);
        }
      } catch (fcmError) {
        console.error('Error sending bulk FCM notification:', fcmError);
      }
    }

    res.status(201).json({
      success: true,
      message: `Notifications sent to ${notifications.length} users`,
      data: {
        notifications,
        totalSent: notifications.length,
        pushNotificationSent: deviceTokens.length
      }
    });

  } catch (error) {
    console.error('Send bulk notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Send notification to topic (admin function)
export const sendTopicNotification = async (req, res) => {
  try {
    const { topic, title, message, type, metadata, sendPush = true } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: 'Topic is required'
      });
    }

    // Send push notification to topic
    if (sendPush) {
      try {
        const fcmNotification = {
          title,
          message,
          type: type || 'general',
          metadata: metadata || {}
        };

        const fcmResult = await sendNotificationToTopic(topic, fcmNotification);
        
        if (!fcmResult.success) {
          return res.status(500).json({
            success: false,
            message: 'Failed to send topic notification',
            error: fcmResult.error
          });
        }
      } catch (fcmError) {
        console.error('Error sending topic FCM notification:', fcmError);
        return res.status(500).json({
          success: false,
          message: 'Failed to send topic notification',
          error: fcmError.message
        });
      }
    }

    res.json({
      success: true,
      message: `Notification sent to topic: ${topic}`,
      data: {
        topic,
        title,
        message,
        type: type || 'general'
      }
    });

  } catch (error) {
    console.error('Send topic notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update user device token
export const updateDeviceToken = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { deviceToken } = req.body;

    if (!deviceToken) {
      return res.status(400).json({
        success: false,
        message: 'Device token is required'
      });
    }

    // Validate device token format (basic validation)
    if (typeof deviceToken !== 'string' || deviceToken.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid device token format'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { deviceToken: deviceToken.trim() },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Device token updated successfully',
      data: {
        userId: user._id,
        deviceTokenUpdated: true
      }
    });

  } catch (error) {
    console.error('Update device token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Remove user device token
export const removeDeviceToken = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findByIdAndUpdate(
      userId,
      { deviceToken: null },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Device token removed successfully',
      data: {
        userId: user._id,
        deviceTokenRemoved: true
      }
    });

  } catch (error) {
    console.error('Remove device token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
