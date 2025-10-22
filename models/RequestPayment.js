import mongoose from 'mongoose';

const requestPaymentSchema = new mongoose.Schema({
    clinicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clinic',
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed'],
        default: 'pending'
    },
    requestDate: {
        type: Date,
        default: Date.now
    },
    processedDate: {
        type: Date
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['bank_transfer', 'stripe']
    },
    bankDetails: {
        accountHolder: String,
        accountNumber: String,
        bankName: String,
        swiftCode: String,
        iban: String
    },
    stripeAccountId: {
        type: String
    },
    notes: {
        type: String
    },
    rejectionReason: {
        type: String
    }
}, {
    timestamps: true
});

// Add index for common queries
requestPaymentSchema.index({ clinicId: 1, status: 1 });
requestPaymentSchema.index({ status: 1, requestDate: -1 });

export default mongoose.model('RequestPayment', requestPaymentSchema);
