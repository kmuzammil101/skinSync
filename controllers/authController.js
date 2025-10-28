import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import VerificationCode from '../models/VerificationCode.js';
import { sendVerificationEmail, sendWelcomeEmail } from '../utils/emailService.js';
import { sendSMS } from '../utils/phoneService.js';
import bcrypt from 'bcryptjs';
import { sendNotificationToDeviceAndSave } from '../utils/fcmService.js';

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};


export const signupController = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // ✅ Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user with hashed password
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      isEmailVerified: false
    });

    await newUser.save();

    // Send welcome email
    // await sendWelcomeEmail(email, name);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: newUser.toJSON()
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🔍 Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // 🔍 Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // 🚫 Check email verification status
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in.',
      });
    }

    // 🔑 Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // 🪙 Generate JWT token
    const token = generateToken(user._id);

    // 🕒 Update last login timestamp
    user.lastLogin = new Date();
    await user.save();

    // 🧩 Prepare response (remove sensitive fields)
    const userResponse = user.toObject();
    delete userResponse.password;

    sendNotificationToDeviceAndSave(user._id, user.deviceToken, {
      title: 'Login successful',
      message: 'You have logged in successfully',
    });
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          ...userResponse,
          token,
          isOnboardingCompleted: !!user.isOnboardingCompleted, // ✅ Added field
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};



// Send OTP for registration/login
export const sendOTP = async (req, res) => {
  try {
    const { type, email, phone } = req.body;
    console.log(req.body)

    const target = type === 'email_verification' ? email : phone;
    if (!target) {
      return res.status(400).json({
        success: false,
        message: type === 'email_verification'
          ? 'Email is required'
          : 'Phone number is required'
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save or update verification code
    await VerificationCode.findOneAndUpdate(
      { [type === 'email_verification' ? 'email' : 'phone']: target, type },
      {
        [type === 'email_verification' ? 'email' : 'phone']: target,
        // code: otp,
        code: 123456, // For testing purposes
        type,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        attempts: 0,
        isUsed: false
      },
      { upsert: true, new: true }
    );

    // Send OTP based on type
    // if (type === 'email_verification') {
    //   await sendVerificationEmail(target, otp);
    // } else if (type === 'phone_verification') {
    //   await sendSMS(target, `Your OTP code is ${otp}`);
    // }

    res.json({
      success: true,
      message: `OTP sent successfully to your ${type === 'email_verification' ? 'email' : 'phone'}`,
      data: {
        type,
        target,
        expiresIn: 600 // 10 minutes
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


export const verifyOTP = async (req, res) => {
  try {
    const { type, email, phone, code } = req.body;
    const target = type === 'email_verification' ? email : phone;

    console.log(`Verifying OTP for ${type}:`, target, 'code:', code);

    // 🔍 Validate type
    if (type !== 'email_verification' && type !== 'phone_verification') {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification type. Must be email_verification or phone_verification.'
      });
    }

    // 🔍 Ensure required data
    if (!target || !code) {
      return res.status(400).json({
        success: false,
        message: 'Target and OTP code are required'
      });
    }

    // 🔍 Check OTP validity
    const query = {
      [type === 'email_verification' ? 'email' : 'phone']: target,
      code,
      type,
      expiresAt: { $gt: new Date() },
    };

    const verificationRecord = await VerificationCode.findOne(query);
    if (!verificationRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // 🔍 Find existing user
    const userQuery = type === 'email_verification' ? { email: target } : { phone: target };
    const existingUser = await User.findOne(userQuery);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found. Please sign up first.'
      });
    }

    // ✅ Update user verification flags
    const updatedUser = await User.findOneAndUpdate(
      userQuery,
      {
        $set: {
          ...(type === 'email_verification'
            ? { isEmailVerified: true }
            : { isPhoneVerified: true }),
          lastLogin: new Date(),
        },
      },
      { new: true }
    );

    console.log('✅ User verified successfully:', updatedUser.email || updatedUser.phone);

    // 🧩 Send response
    return res.json({
      success: true,
      message: `${type === 'email_verification' ? 'Email' : 'Phone'} verified successfully.`,
      data: {
        isNewUser: true,
        requiresProfileCompletion: true, // ✅ Always true for post-signup
        user: {
          ...updatedUser.toJSON(),
          token: generateToken(updatedUser._id),
        },
      },
    });
  } catch (error) {
    console.error('❌ Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
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
    updateData.isOnboardingCompleted = true;

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
    const { email, phone, type } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'OTP type is required.'
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required.'
      });
    }

    const identifier = email || phone;

    // Prevent spam: only one OTP request per minute
    const recentOTP = await VerificationCode.findOne({
      [email ? 'email' : 'phone']: identifier,
      type,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) } // within last 1 minute
    });

    if (recentOTP) {
      return res.status(429).json({
        success: false,
        message: 'Please wait 1 minute before requesting another OTP.'
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP
    await VerificationCode.findOneAndUpdate(
      { [email ? 'email' : 'phone']: identifier, type },
      {
        [email ? 'email' : 'phone']: identifier,
        code: 123456, // 🔧 replace with `otp` in production
        type,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        attempts: 0,
        isUsed: false
      },
      { upsert: true, new: true }
    );

    // Send OTP (email or SMS)
    // if (email) {
    //   await sendVerificationEmail(email, otp);
    // } else {
    //   await sendSMS(phone, `Your OTP code is ${otp}`);
    // }

    res.json({
      success: true,
      message: `OTP resent successfully to your ${email ? 'email' : 'phone number'}.`,
      data: {
        identifier,
        type,
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


//forget password
export const sendForgotPasswordOTP = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required.'
      });
    }

    const identifier = email || phone;
    const type = 'password_reset';
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresIn = 10 * 60 * 1000; // 10 minutes

    // Check if user/clinic exists
    const user = await User.findOne({ $or: [{ email }, { phoneNo: phone }] });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    // Upsert verification record
    await VerificationCode.findOneAndUpdate(
      { email: identifier, type },
      {
        email: identifier,
        // code: otp,
        code: 123456, // For testing purposes
        type,
        expiresAt: new Date(Date.now() + expiresIn),
        attempts: 0,
        isUsed: false
      },
      { upsert: true, new: true }
    );

    // Send OTP via email or SMS
    // if (email) {
    //   await sendVerificationEmail(email, otp);
    // } else {
    //   await sendSMS(phone, `Your password reset OTP is ${otp}`);
    // }

    res.json({
      success: true,
      message: `OTP sent to your ${email ? 'email' : 'phone number'}`,
      expiresIn: expiresIn / 1000
    });
  } catch (error) {
    console.error('Send forgot password OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP.' });
  }
};



export const verifyForgotPasswordOTP = async (req, res) => {
  try {
    const { email, phone, code } = req.body;

    if ((!email && !phone) || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone and OTP are required.'
      });
    }

    const identifier = email || phone;
    const type = 'password_reset';

    const record = await VerificationCode.findOne({
      email: identifier,
      code: code.toString(),
      type,
      expiresAt: { $gt: new Date() },
      isUsed: false
    });

    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const user = await User.findOne({ $or: [{ email }, { phoneNo: phone }] });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    // Mark OTP used
    record.isUsed = true;
    await record.save();

    // Generate a temporary reset token (valid 15 min)
    const resetToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      message: 'OTP verified. Use this token to reset your password.',
      data: { resetToken }
    });
  } catch (error) {
    console.error('Verify forgot password OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};


export const resendForgotPasswordOTP = async (req, res) => {
  try {
    const { email, phone } = req.body;

    // 1️⃣ Validate input
    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required.'
      });
    }

    const identifier = email || phone;
    const type = 'password_reset';
    const expiresIn = 10 * 60 * 1000; // 10 minutes

    // 2️⃣ Prevent spam - allow only one OTP per minute
    const recentOTP = await VerificationCode.findOne({
      [email ? 'email' : 'phone']: identifier,
      type,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) } // within last 1 min
    });

    if (recentOTP) {
      return res.status(429).json({
        success: false,
        message: 'Please wait 1 minute before requesting another OTP.'
      });
    }

    // 3️⃣ Ensure user exists
    const user = await User.findOne({ $or: [{ email }, { phone }] });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found.'
      });
    }

    // 4️⃣ Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 5️⃣ Save or update OTP record
    await VerificationCode.findOneAndUpdate(
      { [email ? 'email' : 'phone']: identifier, type },
      {
        [email ? 'email' : 'phone']: identifier,
        code: 123456, // 🔧 replace with `otp` in production
        type,
        expiresAt: new Date(Date.now() + expiresIn),
        attempts: 0,
        isUsed: false
      },
      { upsert: true, new: true }
    );

    // 6️⃣ Send OTP via correct channel
    // if (email) {
    //   await sendVerificationEmail(email, otp);
    // } else {
    //   await sendSMS(phone, `Your password reset OTP is ${otp}`);
    // }

    // 7️⃣ Respond
    res.json({
      success: true,
      message: `A new OTP has been sent to your ${email ? 'email' : 'phone number'}.`,
      data: {
        identifier,
        expiresIn: expiresIn / 1000 // seconds
      }
    });
  } catch (error) {
    console.error('Resend Forgot Password OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again.'
    });
  }
};



export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password directly
    const user = await User.findOneAndUpdate(
      { _id: userId },
      { password: hashedPassword },
      { new: true } // return updated doc (optional)
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({
      success: true,
      message: 'Password reset successful.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Reset token expired.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to reset password.'
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