import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters']
  },
  bio: {
    type: String,
    trim: true,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  skintype: {
    type: [String],
    enum: [
      "Oily Skin",
      "Dry Skin", 
      "Combination Skin",
      "Sensitive Skin",
      "Normal Skin"
    ],
    default: []
  },
  skinConcerns: {
    type: [String],
    enum: [
      "Acne Or Breakouts",
      "Fine Lines Or Wrinkles", 
      "Dark Spots Or Pigmentation",
      "Redness Or Irritation",
      "Dryness Or Dehydration",
      "Dullness Or Uneven Tone",
      "None Of Them"
    ],
    default: []
  },
  lifestyle: {
    type: [String],
    enum: [
      "Do You Spend A lot Of Time Outdoors?",
      "Do You Currently Follow A Skincare Regimen?",
      "Do You Eat A Balanced Diet With Plenty Of Water?",
      "Do You Get 7–8 Hours Of Sleep Regularly?",
      "Do You Experience High Levels Of Stress?"
    ],
    default: []
  },
  skinCondition: {
    type: [String],
    enum: [
      "Acne",
      "Eczema", 
      "Psoriasis",
      "Rosacea",
      "None Of The Above"
    ],
    default: []
  },
  medication: {
    type: String,
    default: null
  },
  skinGoals: {
    type: [String],
    enum: [
      "Clearer Skin (Reduce Acne Or Breakouts)",
      "Brighter Skin (Reduce Dullness Or Dark Spots)",
      "Firmer Skin (Reduce Fine Lines Or Wrinkles)", 
      "Hydrated Skin (Reduce Dryness Or Flakiness)",
      "Even Skin Tone (Reduce Redness Or Pigmentation)"
    ],
    default: []
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationCode: {
    type: String,
    default: null
  },
  emailVerificationExpires: {
    type: Date,
    default: null
  },
  notificationsEnabled: {
    type: Boolean,
    default: false
  },
  profileImage: {
    type: String,
    default: null
  },
  lastLogin: {
    type: Date,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  deviceToken: { type: String }
}, {
  timestamps: true
});

// No password-related methods needed for passwordless authentication

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.emailVerificationCode;
  delete userObject.emailVerificationExpires;
  return userObject;
};

export default mongoose.model('User', userSchema);
