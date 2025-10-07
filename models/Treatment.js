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

const treatmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  treatmentType: {
    type: String,
    enum: [
      "all",
      "Skincare & Facial",
      "Injectables & Fillers",
      "Laser Treatments",
      "Sculpting & Contouring",
      "Rejuvenation"
    ],
    required: true
  },
  subType: {
    type: String,
    enum: [
      "Lip Augmentation",
      "Cheek Fillers",
      "Jawline Contouring",
      "Under-Eye Fillers",
      "Nose Job"
    ]
  },
  clinicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
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
  beforeImage: {
    type: String,
    required: true
  },
  afterImage: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },

  // ⭐ Array of reviews
  userReviews: [reviewSchema],

  // ⭐ Average rating
  ratingStars: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },

  // ⭐ Total number of reviews
  ratingsCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 🔄 Method to calculate average rating
treatmentSchema.methods.calculateAverageRating = function () {
  if (this.userReviews.length === 0) {
    this.ratingStars = 0;
    this.ratingsCount = 0;
  } else {
    const total = this.userReviews.reduce((acc, r) => acc + r.ratingStars, 0);
    this.ratingStars = total / this.userReviews.length;
    this.ratingsCount = this.userReviews.length;
  }
  return this.save();
};

export default mongoose.model('Treatment', treatmentSchema);
