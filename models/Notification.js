import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: false
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: [
      'appointment_reminder',
      'appointment_reschedule', 
      'appointment_confirmed', 
      'appointment_cancelled',
      'promotion', 
      'clinic_update', 
      'loyalty_points',
      'treatment_available',
      'general'
    ],
    default: 'general'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  scheduledFor: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for efficient queries
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ scheduledFor: 1 });

export default mongoose.model('Notification', notificationSchema);
