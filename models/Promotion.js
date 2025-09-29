import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  treatmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Treatment',
    required: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  validFrom: {
    type: Date,
    required: true
  },
  validTill: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Promotion', promotionSchema);
