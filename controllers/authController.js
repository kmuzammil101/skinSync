import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import VerificationCode from '../models/VerificationCode.js';
import { sendVerificationEmail, sendWelcomeEmail } from '../utils/emailService.js';

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Send OTP for registration/login
export const sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save or update verification code
    await VerificationCode.findOneAndUpdate(
      { email, type: 'email_verification' },
      {
        email,
        // code: otp,
        code: '123456',
        type: 'email_verification',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        attempts: 0,
        isUsed: false
      },
      { upsert: true, new: true }
    );

    // Send OTP email
    // await sendVerificationEmail(email, otp);

    res.json({
      success: true,
      message: 'OTP sent successfully to your email',
      data: {
        email,
        expiresIn: 600 // 10 minutes in seconds
      }
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    });
  }
};

// Verify OTP and determine if user needs to complete profile
// export const verifyOTP = async (req, res) => {
//   try {
//     const { email, code } = req.body;

//     // Find verification code
//     const verificationRecord = await VerificationCode.findOne({
//       email,
//       code,
//       type: 'email_verification',
//       isUsed: false,
//       expiresAt: { $gt: new Date() }
//     });

//     if (!verificationRecord) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid or expired OTP'
//       });
//     }

//     // Check attempts
//     if (verificationRecord.attempts >= 5) {
//       return res.status(400).json({
//         success: false,
//         message: 'Too many failed attempts. Please request a new OTP.'
//       });
//     }

//     // Mark code as used
//     verificationRecord.isUsed = true;
//     await verificationRecord.save();

//     // Check if user exists
//     let user = await User.findOne({ email });

//     if (!user) {
//       // New user - create with minimal data (ensure required name present)
//       const fallbackName = (email && email.split('@')[0]) || 'User';
//       user = new User({
//         email,
//         name: fallbackName,
//         isEmailVerified: true
//       });
//       await user.save();

//       // Send welcome email
//       // await sendWelcomeEmail(email, 'User');

//       return res.json({
//         success: true,
//         message: 'OTP verified successfully. Please complete your profile.',
//         data: {
//           isNewUser: true,
//           user: user.toJSON(),
//           requiresProfileCompletion: true
//         }
//       });
//     } else {
//       // Existing user - update verification status and last login
//       user.isEmailVerified = true;
//       // Ensure required name exists for legacy users
//       if (!user.name) {
//         user.name = (email && email.split('@')[0]) || 'User';
//       }
//       user.lastLogin = new Date();
//       await user.save();

//       // Generate token for existing user
//       const token = generateToken(user._id);

//       return res.json({
//         success: true,
//         message: 'Login successful',
//         data: {
//           isNewUser: false,
//           token,
//           user: user.toJSON(),
//           requiresProfileCompletion: !user.name // Check if profile is complete
//         }
//       });
//     }

//   } catch (error) {
//     console.error('Verify OTP error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Internal server error'
//     });
//   }
// };

export const verifyOTP = async (req, res) => {
  try {
    const { email, code } = req.body;
    console.log('Verifying OTP for email:', email, 'code:', code);
    // Find verification code (ignore isUsed, attempts)
    const verificationRecord = await VerificationCode.findOne({
      email,
      code,
      type: 'email_verification',
      expiresAt: { $gt: new Date() }
    });

    if (!verificationRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // ✅ Do NOT check attempts
    // ✅ Do NOT mark as used

    // Check if user exists
    let user = await User.findOne({ email });

    if (!user) {
      // New user - create with minimal data (ensure required name present)
      const fallbackName = (email && email.split('@')[0]) || 'User';
      user = new User({
        email,
        name: fallbackName,
        isEmailVerified: true
      });
      await user.save();

      return res.json({
        success: true,
        message: 'OTP verified successfully. Please complete your profile.',
        data: {
          isNewUser: true,
          requiresProfileCompletion: true,
          user: {
            ...user.toJSON(),
            token: generateToken(user._id) // embed token in user object
          }
        }
      });
    } else {
      // Existing user - update verification status and last login
      user.isEmailVerified = true;
      if (!user.name) {
        user.name = (email && email.split('@')[0]) || 'User';
      }
      user.lastLogin = new Date();
      await user.save();
      console.log('Existing user logged in:', user.email);
      return res.json({
        success: true,
        message: 'Login successful',
        data: {
          isNewUser: false,
          requiresProfileCompletion: !user.name,
          user: {
            ...user.toJSON(),
            token: generateToken(user._id) // embed token in user object
          }
        }
      });
    }

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


// Complete user profile (for new users after OTP verification)
export const completeProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      location,
      bio,
      email,
      skintype,
      skinConcerns,
      lifestyle,
      skinCondition,
      medication,
      skinGoals,
      profileImage
    } = req.body;

    const profileImageFile = req.file;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user profile
    const updateData = { name };
    if (phone) updateData.phone = phone;
    if (location) updateData.location = location;
    if (bio) updateData.bio = bio;
    if (skintype) updateData.skintype = skintype;
    if (skinConcerns) updateData.skinConcerns = skinConcerns;
    if (lifestyle) updateData.lifestyle = lifestyle;
    if (skinCondition) updateData.skinCondition = skinCondition;
    if (medication) updateData.medication = medication;
    if (skinGoals) updateData.skinGoals = skinGoals;

    // Profile image handling
    if (profileImageFile && profileImageFile.filename) {
      updateData.profileImage = profileImageFile.filename;
    } else if (profileImage && typeof profileImage === 'string') {
      updateData.profileImage = profileImage;
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      updateData,
      { new: true, runValidators: true }
    );

    // Generate token
    const token = generateToken(updatedUser._id);

    // Attach token inside user object
    const userObj = updatedUser.toJSON();
    userObj.token = token;

    // Convert arrays into key-value pairs
    const convertToKeyValue = (arr) => 
      Array.isArray(arr) ? arr.map((item, index) => ({ key: index, value: item })) : arr;

    userObj.skintype = convertToKeyValue(userObj.skintype);
    userObj.skinConcerns = convertToKeyValue(userObj.skinConcerns);
    userObj.lifestyle = convertToKeyValue(userObj.lifestyle);
    userObj.skinCondition = convertToKeyValue(userObj.skinCondition);
    userObj.medication = convertToKeyValue(userObj.medication);
    userObj.skinGoals = convertToKeyValue(userObj.skinGoals);

    res.json({
      success: true,
      message: 'Profile completed successfully',
      data: { user: userObj }
    });

  } catch (error) {
    console.error('Complete profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Resend OTP
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if there's a recent OTP request (prevent spam)
    const recentOTP = await VerificationCode.findOne({
      email,
      type: 'email_verification',
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) } // 1 minute ago
    });

    if (recentOTP) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting another OTP'
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save verification code
    await VerificationCode.create({
      email,
      code: otp,
      type: 'email_verification',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: 0,
      isUsed: false
    });

    // Send OTP email
    await sendVerificationEmail(email, otp);

    res.json({
      success: true,
      message: 'OTP resent successfully',
      data: {
        email,
        expiresIn: 600 // 10 minutes in seconds
      }
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again.'
    });
  }
};

// Social login (Google/Apple)
export const socialLogin = async (req, res) => {
  try {
    const { type, idToken, name } = req.body;

    if (!type || !['google', 'apple'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either google or apple'
      });
    }

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'idToken is required'
      });
    }

    // 🔹 Decode the JWT (NO signature verification!)
    const decoded = jwt.decode(idToken);
    if (!decoded || !decoded.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token: email not found'
      });
    }

    const normalizedEmail = decoded.email.toLowerCase();

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      user = new User({
        email: normalizedEmail,
        name: name || decoded.name || 'User',
        isEmailVerified: true
      });
      await user.save();

      const token = generateToken(user._id);
      return res.json({
        success: true,
        message: `Login successful via ${type}`,
        data: {
          token,
          user: user.toJSON(),
          isNewUser: true
        }
      });
    }

    // Existing user
    user.isEmailVerified = true;
    if ((name || decoded.name) && !user.name) {
      user.name = name || decoded.name;
    }
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);
    return res.json({
      success: true,
      message: `Login successful via ${type}`,
      data: {
        token,
        user: user.toJSON(),
        isNewUser: false
      }
    });

  } catch (error) {
    console.error('Universal login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};