import jwt from 'jsonwebtoken';
import Clinic from '../models/Clinic.js';
import VerificationCode from '../models/VerificationCode.js';
import { sendVerificationEmail } from '../utils/emailService.js';

// Generate JWT Token for clinic user
const generateToken = (clinicId) => {
  return jwt.sign({ clinicId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};


export const sendClinicOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const otp = 123456; // for testing
    const expiresIn = 10 * 60 * 1000; // 10 minutes

    // Upsert verification code
    await VerificationCode.findOneAndUpdate(
      { email, type: 'clinic_email_verification' },
      {
        email,
        code: otp.toString(), // ✅ always string for consistency
        type: 'clinic_email_verification',
        expiresAt: new Date(Date.now() + expiresIn),
        attempts: 0,
        isUsed: false
      },
      { upsert: true, new: true }
    );

    // Check if clinic exists
    const existingClinic = await Clinic.findOne({ email });

    res.json({
      success: true,
      message: 'OTP sent to clinic email',
      data: {
        email,
        isNewUser: !existingClinic,
        expiresIn: expiresIn / 1000
      }
    });
  } catch (error) {
    console.error('Error sending clinic OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP.' });
  }
};





export const verifyClinicOTP = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and OTP code are required.' });
    }

    // Check OTP record
    const verificationRecord = await VerificationCode.findOne({
      email,
      code: code.toString(), // ensure same type
      type: 'clinic_email_verification',
      expiresAt: { $gt: new Date() },
      isUsed: false
    });

    if (!verificationRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Find or create clinic
    let clinic = await Clinic.findOne({ email });
    let isNewUser = false;
    if (!clinic) {
      clinic = await Clinic.create({ email });
      isNewUser = true;
    }

    // Generate token
    const token = generateToken(clinic._id);

    // Attach token to clinic object
    clinic = clinic.toObject(); // convert mongoose document to plain object
    clinic.token = token;

    // Mark OTP used
    verificationRecord.isUsed = true;
    await verificationRecord.save();

    res.json({
      success: true,
      message: 'Clinic verified successfully',
      data: { clinic, isNewUser }
    });
  } catch (error) {
    console.error('Error verifying clinic OTP:', error);
    res.status(500).json({ success: false, message: 'Failed to verify OTP.' });
  }
};


