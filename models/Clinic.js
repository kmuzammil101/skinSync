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

const slowDaySchema = new mongoose.Schema({
    daysOfWeek: {
        type: [String], // e.g. ["Mon", "Tue"]
        required: true
    },
    timeRange: {
        start: { type: String, required: true }, // or Date if you prefer parsing
        end: { type: String, required: true }
    }
});

const clinicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    treatments: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Treatment'
    },
    website: {
        type: String,
    },
    buisnessHours: {
        type: String,
        required: true
    },
    slowDays: [slowDaySchema],
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
        required: true
    },
    email: {
        type: String,
        required: true
    },
    
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
    
    // Social media links
    socialMedia: {
        facebook: { type: String },
        instagram: { type: String },
        twitter: { type: String }
    }
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

export default mongoose.model('Clinic', clinicSchema);