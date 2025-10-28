import jwt from 'jsonwebtoken';
import Clinic from '../models/Clinic.js';
import VerificationCode from '../models/VerificationCode.js';
import bcrypt from "bcryptjs"
import { sendVerificationEmail } from '../utils/emailService.js';
import { sendSMS } from '../utils/phoneService.js';

// Generate JWT Token for clinic user
const generateToken = (clinicId) => {
  return jwt.sign({ clinicId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};


export const sendClinicOTP = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Either email or phone number is required.'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresIn = 10 * 60 * 1000; // 10 minutes

    // Determine verification type
    const type = email ? 'clinic_email_verification' : 'phone_verification';
    const identifier = email || phone;

    // Upsert verification code
    await VerificationCode.findOneAndUpdate(
      { email: identifier, type },
      {
        email: identifier,
        // code: otp,
        code: 123456, // For testing purposes, use a fixed OTP
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
    //   await sendSMS(phone, `Your SkinSync OTP code is ${otp}`);
    // }

    // Check if clinic exists
    const existingClinic = await Clinic.findOne({ $or: [{ email }, { phone }] });

    res.json({
      success: true,
      message: `OTP sent successfully to ${email ? 'email' : 'phone number'}`,
      data: {
        identifier,
        isNewUser: !existingClinic,
        expiresIn: expiresIn / 1000
      }
    });
  } catch (error) {
    console.error('Error sending clinic OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP.'
    });
  }
};

// ------------------ 🔵 VERIFY OTP ------------------
export const verifyClinicOTP = async (req, res) => {
  try {
    const { email, phone, code } = req.body;

    // 🧩 Validate input
    if ((!email && !phone) || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone and OTP code are required.',
      });
    }

    const type = email ? 'clinic_email_verification' : 'phone_verification';

    // 🧩 Find verification record
    const verificationQuery = {
      type,
      code: code.toString(),
      expiresAt: { $gt: new Date() },
      isUsed: false,
      ...(email ? { email } : { phone }),
    };

    const verificationRecord = await VerificationCode.findOne(verificationQuery);
    if (!verificationRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP.',
      });
    }

    // 🏥 Upsert clinic record
    const updateFields = {
      $set: {
        ...(email
          ? { isClinicEmailVerified: true, email }
          : { isClinicPhoneVerified: true, phone }),
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    };

    const clinic = await Clinic.findOneAndUpdate(
      { $or: [{ email }, { phone }] },
      updateFields,
      { upsert: true, new: true }
    );
    const isNewUser = clinic.createdAt.getTime() === clinic.updatedAt.getTime();

    // 🪙 Generate token
    const token = generateToken(clinic._id);

    // 🔒 Mark OTP as used
    verificationRecord.isUsed = true;
    await verificationRecord.save();

    // 🧩 Prepare response
    const clinicResponse = clinic.toObject();
    delete clinicResponse.password; // if password field exists

    return res.json({
      success: true,
      message: `Clinic ${email ? 'email' : 'phone'} verified successfully.`,
      data: {
        clinic: {
          ...clinicResponse,
          token,
        },
        isNewUser,
      },
    });
  } catch (error) {
    console.error('Error verifying clinic OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP.',
    });
  }
};




export const resendClinicOTP = async (req, res) => {
  try {
    const { email, phone, type = 'clinic_verification' } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required.'
      });
    }

    const identifier = email || phone;

    // Prevent spam — allow 1 OTP per minute
    const recentOTP = await VerificationCode.findOne({
      [email ? 'email' : 'phone']: identifier,
      type,
      createdAt: { $gt: new Date(Date.now() - 60 * 1000) } // within last 1 minute
    });

    if (recentOTP) {
      return res.status(429).json({
        success: false,
        message: 'Please wait before requesting another OTP.'
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Upsert new verification code
    await VerificationCode.findOneAndUpdate(
      { [email ? 'email' : 'phone']: identifier, type },
      {
        [email ? 'email' : 'phone']: identifier,
        code: 123456, // ⚠️ replace with `otp` in production
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
    //   await sendSMS(phone, `Your clinic verification code is ${otp}`);
    // }

    res.json({
      success: true,
      message: `OTP resent successfully to your ${email ? 'email' : 'phone number'}.`,
      data: {
        identifier,
        type,
        expiresIn: 600 // 10 minutes
      }
    });
  } catch (error) {
    console.error('Error resending clinic OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again later.'
    });
  }
};



export const clinicSignup = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and phone are required'
      });
    }

    // Check if clinic already exists
    const existingClinic = await Clinic.findOne({ email });
    if (existingClinic) {
      return res.status(400).json({
        success: false,
        message: 'Clinic already registered with this email'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create clinic
    const newClinic = await Clinic.create({
      name,
      email,
      phone,
      password: hashedPassword,
      isClinicRegister: true
    });

    // Send response
    const clinicObj = newClinic.toObject();
    delete clinicObj.password;

    res.status(201).json({
      success: true,
      message: 'Clinic registered successfully',
      data: {
        clinic: clinicObj
      }
    });
  } catch (error) {
    console.error('Clinic signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during signup'
    });
  }
};

// ------------------ 🟦 LOGIN ------------------
export const clinicLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Check if clinic exists
    const clinic = await Clinic.findOne({ email });
    if (!clinic) {
      return res.status(400).json({
        success: false,
        message: 'No clinic found with this email'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, clinic.password || '');
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken(clinic._id);

    const clinicObj = clinic.toObject();
    delete clinicObj.password;

    res.json({
      success: true,
      message: 'Clinic login successful',
      data: {
        token,
        clinic: clinicObj
      }
    });
  } catch (error) {
    console.error('Clinic login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};


export const sendForgetPassOTP = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required.'
      });
    }

    const clinic = await Clinic.findOne({ $or: [{ email }, { phone }] });
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found with provided email or phone.'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresIn = 10 * 60 * 1000; // 10 minutes
    const type = email ? 'clinic_forget_email' : 'clinic_forget_phone';
    const identifier = email || phone;

    await VerificationCode.findOneAndUpdate(
      { email: identifier, type },
      {
        email: identifier,
        code: 123456, // 🔧 For testing — replace with otp later
        type,
        expiresAt: new Date(Date.now() + expiresIn),
        attempts: 0,
        isUsed: false
      },
      { upsert: true, new: true }
    );

    // Send OTP
    // if (email) await sendVerificationEmail(email, otp);
    // else await sendSMS(phone, `Your password reset OTP is ${otp}`);

    res.json({
      success: true,
      message: `Password reset OTP sent to ${email ? 'email' : 'phone number'}.`,
      data: { identifier, expiresIn: expiresIn / 1000 }
    });
  } catch (error) {
    console.error('Error sending forgot password OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send password reset OTP.'
    });
  }
};

// ------------------ 🟦 VERIFY FORGOT PASSWORD OTP ------------------
export const verifyForgetPassOTP = async (req, res) => {
  try {
    const { email, phone, code } = req.body;

    if ((!email && !phone) || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone and OTP are required.'
      });
    }

    const identifier = email || phone;
    const type = email ? 'clinic_forget_email' : 'clinic_forget_phone';

    const verificationRecord = await VerificationCode.findOne({
      email: identifier,
      code: code.toString(),
      type,
      expiresAt: { $gt: new Date() },
      isUsed: false
    });

    if (!verificationRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP.'
      });
    }

    const clinic = await Clinic.findOne({ $or: [{ email }, { phone }] });
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found.'
      });
    }

    // Generate short-lived reset token (15 min)
    const resetToken = jwt.sign(
      { clinicId: clinic._id },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    verificationRecord.isUsed = true;
    await verificationRecord.save();

    res.json({
      success: true,
      message: 'OTP verified successfully. Use the token to reset your password.',
      data: { resetToken }
    });
  } catch (error) {
    console.error('Error verifying forgot password OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP.'
    });
  }
};

// ------------------ 🟨 RESEND FORGOT PASSWORD OTP ------------------
export const resendForgetPassOTP = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone number is required.'
      });
    }

    const identifier = email || phone;
    const type = email ? 'clinic_forget_email' : 'clinic_forget_phone';

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresIn = 10 * 60 * 1000;

    await VerificationCode.findOneAndUpdate(
      { email: identifier, type },
      {
        email: identifier,
        code: 123456, // 🔧 For testing
        type,
        expiresAt: new Date(Date.now() + expiresIn),
        attempts: 0,
        isUsed: false
      },
      { upsert: true, new: true }
    );

    // Send OTP
    // if (email) await sendVerificationEmail(email, otp);
    // else await sendSMS(phone, `Your password reset OTP is ${otp}`);

    res.json({
      success: true,
      message: `New OTP sent successfully to ${email ? 'email' : 'phone'}.`,
      data: { identifier, expiresIn: expiresIn / 1000 }
    });
  } catch (error) {
    console.error('Error resending forgot password OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend OTP.'
    });
  }
};

// ------------------ 🟥 RESET CLINIC PASSWORD ------------------
export const resetClinicPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required.'
      });
    }

    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedClinic = await Clinic.findOneAndUpdate(
      { _id: decoded.clinicId },
      { password: hashedPassword },
      { new: true }
    );

    if (!updatedClinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found.'
      });
    }

    res.json({
      success: true,
      message: 'Password reset successfully.'
    });
  } catch (error) {
    console.error('Error resetting clinic password:', error);
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
