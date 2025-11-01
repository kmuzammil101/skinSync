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
    const { email, phone, code, purpose } = req.body;

    // 🧩 Validate input
    if ((!email && !phone) || !code || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Email or phone, OTP code, and purpose are required.',
      });
    }

    const identifier = email || phone;

    let type;
    switch (purpose) {
      case 'verification':
        type = email ? 'clinic_email_verification' : 'phone_verification';
        break;
      case 'forgot_password':
        type = email ? 'clinic_forget_email' : 'clinic_forget_phone';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid purpose provided.',
        });
    }

    // 🧩 Find verification record
    const verificationRecord = await VerificationCode.findOne({
      code: code.toString(),
      type,
      expiresAt: { $gt: new Date() },
      isUsed: false,
      ...(email ? { email } : { phone }),
    });

    if (!verificationRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP.',
      });
    }

    // ✅ Handle based on purpose
    if (purpose === 'verification') {
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

      // 🔒 Generate auth token
      const token = generateToken(clinic._id);

      // Mark OTP as used
      verificationRecord.isUsed = true;
      await verificationRecord.save();

      const clinicResponse = clinic.toObject();
      delete clinicResponse.password; // Remove password if exists

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
    } else if (purpose === 'forgot_password') {
      const clinic = await Clinic.findOne({ $or: [{ email }, { phone }] });
      if (!clinic) {
        return res.status(404).json({
          success: false,
          message: 'Clinic not found.',
        });
      }

      // Generate short-lived reset token (15 min)
      const resetToken = jwt.sign(
        { clinicId: clinic._id },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      // Mark OTP as used
      verificationRecord.isUsed = true;
      await verificationRecord.save();

      return res.json({
        success: true,
        message: 'OTP verified successfully. Use the token to reset your password.',
        data: { resetToken },
      });
    }
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
    const { name, email, password, phone, deviceToken } = req.body;

    // 🔹 1. Validate required fields
    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and phone are required',
      });
    }

    // 🔹 2. Check if clinic already exists
    const existingClinic = await Clinic.findOne({ email });
    if (existingClinic) {
      return res.status(400).json({
        success: false,
        message: 'Clinic already registered with this email',
      });
    }

    // 🔹 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 🔹 4. Create new clinic with optional deviceToken
    const newClinic = await Clinic.create({
      name,
      email,
      phone,
      password: hashedPassword,
      isClinicRegister: true,
      isClinicEmailVerified: false,
      deviceToken: deviceToken ? Array.isArray(deviceToken) ? deviceToken : [deviceToken] : [],
    });

    // 🔹 5. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresIn = 10 * 60 * 1000; // 10 minutes

    // 🔹 6. Determine verification type (email first)
    const type = email ? 'clinic_email_verification' : 'phone_verification';
    const identifier = email || phone;

    // 🔹 7. Save / Update OTP in VerificationCode collection
    await VerificationCode.findOneAndUpdate(
      { [email ? 'email' : 'phone']: identifier, type },
      {
        [email ? 'email' : 'phone']: identifier,
        code: otp, // Use actual OTP
        type,
        expiresAt: new Date(Date.now() + expiresIn),
        attempts: 0,
        isUsed: false,
      },
      { upsert: true, new: true }
    );

    // 🔹 8. Send OTP (uncomment when ready)
    // if (email) {
    //   await sendVerificationEmail(email, otp);
    // } else {
    //   await sendSMS(phone, `Your SkinSync Clinic OTP code is ${otp}`);
    // }

    // 🔹 9. Prepare clean response object
    const clinicObj = newClinic.toObject();
    delete clinicObj.password;

    // 🔹 10. Respond with success + OTP info
    res.status(201).json({
      success: true,
      message: `Clinic registered successfully. OTP sent to your ${email ? 'email' : 'phone number'}.`,
      data: {
        clinic: clinicObj,
        otpInfo: {
          identifier,
          type,
          expiresIn: expiresIn / 1000, // seconds
        },
      },
    });
  } catch (error) {
    console.error('Clinic signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during signup',
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

    // If email not verified — send OTP again
    if (!clinic.isClinicEmailVerified) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresIn = 10 * 60 * 1000; // 10 minutes
      const type = 'clinic_email_verification';

      // Upsert OTP for email verification
      await VerificationCode.findOneAndUpdate(
        { email: clinic.email, type },
        {
          email: clinic.email,
          code: 123456, // For testing, fixed OTP — replace with `otp` later
          type,
          expiresAt: new Date(Date.now() + expiresIn),
          attempts: 0,
          isUsed: false
        },
        { upsert: true, new: true }
      );

      // Optionally send via email or SMS
      // await sendVerificationEmail(clinic.email, otp);

      return res.status(403).json({
        success: false,
        message: 'Clinic email not verified. OTP sent again to email.',
        data: {
          email: clinic.email,
          expiresIn: expiresIn / 1000
        }
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

// ------------------ 🔵 CLINIC SOCIAL LOGIN (Google/Apple) ------------------
export const clinicSocialLogin = async (req, res) => {
  try {
    const { type, idToken, name, deviceToken } = req.body;

    // Validate type
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

    // Decode the JWT (NO signature verification in this basic implementation)
    // In production, you should verify the token signature with Google/Apple
    const decoded = jwt.decode(idToken);
    if (!decoded || !decoded.email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token: email not found'
      });
    }

    const normalizedEmail = decoded.email.toLowerCase();

    // Check if clinic exists
    let clinic = await Clinic.findOne({ email: normalizedEmail });

    if (!clinic) {
      // Create new clinic account
      // Generate a random password for social login accounts (they won't use it)
      const randomPassword = await bcrypt.hash(Math.random().toString(36) + Date.now().toString(), 10);
      clinic = new Clinic({
        email: normalizedEmail,
        name: name || decoded.name || 'Clinic',
        isClinicEmailVerified: true,
        isClinicRegister: true,
        password: randomPassword, // Random password for social login accounts
        deviceToken: deviceToken ? (Array.isArray(deviceToken) ? deviceToken : [deviceToken]) : []
      });
      await clinic.save();

      const token = generateToken(clinic._id);
      const clinicObj = clinic.toObject();
      delete clinicObj.password;

      return res.json({
        success: true,
        message: `Clinic login successful via ${type}`,
        data: {
          token,
          clinic: clinicObj,
          isNewUser: true
        }
      });
    }

    // Existing clinic
    clinic.isClinicEmailVerified = true;
    clinic.isClinicRegister = true;
    
    // Update name if provided and not set
    if ((name || decoded.name) && !clinic.name) {
      clinic.name = name || decoded.name;
    }

    // Update device token if provided
    if (deviceToken) {
      const tokens = Array.isArray(deviceToken) ? deviceToken : [deviceToken];
      const existingTokens = clinic.deviceToken || [];
      const newTokens = [...new Set([...existingTokens, ...tokens])];
      clinic.deviceToken = newTokens;
    }

    await clinic.save();

    const token = generateToken(clinic._id);
    const clinicObj = clinic.toObject();
    delete clinicObj.password;

    return res.json({
      success: true,
      message: `Clinic login successful via ${type}`,
      data: {
        token,
        clinic: clinicObj,
        isNewUser: false
      }
    });

  } catch (error) {
    console.error('Clinic social login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during social login'
    });
  }
};

// ------------------ 🔴 CLINIC LOGOUT ------------------
export const clinicLogout = async (req, res) => {
  try {
    const clinicId = req.clinic?.clinicId;

    if (!clinicId) {
      return res.status(401).json({
        success: false,
        message: 'Clinic not authenticated'
      });
    }

    // Clear device tokens
    await Clinic.findByIdAndUpdate(
      clinicId,
      { $set: { deviceToken: [] } },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Clinic logged out successfully. Please discard the JWT token on the client side.'
    });
  } catch (error) {
    console.error('Clinic logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during logout'
    });
  }
};