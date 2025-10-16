import mongoose from 'mongoose';

const clinicTransactionSchema = new mongoose.Schema({
  clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true },
  // Types: hold (platform holds money for clinic), release (admin releases held funds to clinic wallet),
  // credit (clinic wallet credited), debit (clinic wallet debited on withdraw), platform_receipt (platform received payment)
  type: { type: String, enum: ['credit', 'debit', 'hold', 'release', 'platform_receipt','refunded','cancelled'], required: true },
  amount: { type: Number, required: true }, // cents
  currency: { type: String, default: 'usd' },
  description: { type: String },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  paymentIntentId: { type: String },
  stripeTransferId: { type: String },
  stripeChargeId: { type: String },
  stripePayoutId: { type: String },
  metadata: { type: Object },
  // controls whether this transaction should be shown in clinic wallet listing
  visible: { type: Boolean, default: true },
  imageForProof: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('ClinicTransaction', clinicTransactionSchema);
