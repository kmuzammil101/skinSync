import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ratingStars: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    comment: {
        type: String,
        maxlength: 500
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const proofOfExpertise = new mongoose.Schema({
    image: { type: String },
    name: { type: String }
});

const businessHoursSchema = new mongoose.Schema({
    daysOfWeek: {
        type: [String],
    },
    timeRange: {
        start: { type: String, }, // or Date if you prefer parsing
        end: { type: String, }
    }
});

const clinicSchema = new mongoose.Schema({
    name: {
        type: String,
        // required: true
    },
    onBoarding: {
        type: Boolean,
        default: false
    },
    isClinicCreated: {
        type: Boolean,
        default: false
    },
    isClinicRegister:{
        type: Boolean,
        default: false
    },
    description: {
        type: String,
        // required: true
    },
    image: {
        type: String,
        // required: true
    },
    address: {
        type: String,
        // required: true
    },
    discountPercentageForAllTreatments: {
        type: Number,
        default: 0
    },
    website: {
        type: String,
    },
    businessHours: [businessHoursSchema],
    proofOfExpertise: {
        type: [proofOfExpertise],
    },
    userReviews: [reviewSchema],

    // Average rating and review count
    ratingStars: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
    ratingsCount: {
        type: Number,
        default: 0
    },

    // Contact information
    phone: {
        type: String,
        // required: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    // Stripe Connect fields
    stripeAccountId: { type: String }, // connected account id (acct_...)
    accountType: { type: String, enum: ['express', 'standard', 'custom'], default: 'express' },
    onboardingComplete: { type: Boolean, default: false },
    // Optional: mirror of clinic in-app wallet (cents)
    walletBalance: { type: Number, default: 0 },
    // Held balance: funds received by platform but held for clinic until admin releases (cents)
    heldBalance: { type: Number, default: 0 },

    // Location details
    coordinates: {
        latitude: { type: Number },
        longitude: { type: Number }
    },

    // Status and availability
    isActive: {
        type: Boolean,
        default: true
    },
}, {
    timestamps: true
});

// Method to calculate average rating
clinicSchema.methods.calculateAverageRating = function () {
    if (this.userReviews.length === 0) {
        this.ratingStars = 0;
        this.ratingsCount = 0;
    } else {
        const total = this.userReviews.reduce((acc, review) => acc + review.ratingStars, 0);
        this.ratingStars = Math.round((total / this.userReviews.length) * 10) / 10; // Round to 1 decimal
        this.ratingsCount = this.userReviews.length;
    }
    return this.save();
};

clinicSchema.virtual('treatments', {
    ref: 'Treatment',
    localField: '_id',
    foreignField: 'clinicId'
});

clinicSchema.set('toObject', { virtuals: true });
clinicSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Clinic', clinicSchema);