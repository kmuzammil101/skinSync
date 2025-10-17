import mongoose from 'mongoose';

const userTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Types: credit (wallet credited), debit (wallet debited on withdraw), hold (platform holds money for clinic/admin), platform_charge (platform charged user)
  type: { type: String, enum: ['credit', 'debit', 'hold', 'platform_charge', 'refund'], required: true },
  amount: { type: Number, required: true }, // cents
  currency: { type: String, default: 'usd' },
  description: { type: String },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  paymentIntentId: { type: String },
  stripeChargeId: { type: String },
  metadata: { type: Object },
  discountPercentage:{
    type: Number,
    default: 0
  },
  // controls whether this transaction should be shown in user wallet listing
  visible: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('UserTransaction', userTransactionSchema);
