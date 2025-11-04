import mongoose from "mongoose"

const appointmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
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
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'paid', 'failed', 'refunded', 'completed', 'ongoing','reschedule_on_another_day'],
        default: 'pending'
    },
    completionPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    // Payment related fields
    amount: { type: Number }, // price in smallest currency unit (e.g., cents)
    currency: { type: String, default: 'usd' },
    stripePaymentIntentId: { type: String },
    paymentStatus: { type: String, enum: ['unpaid', 'processing', 'paid', 'failed', 'refunded'], default: 'unpaid' },
    stripeChargeId: { type: String }
}, {
    timestamps: true
});

export default mongoose.model('Appointment', appointmentSchema);

