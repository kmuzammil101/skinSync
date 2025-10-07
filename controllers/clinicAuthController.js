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

// Send OTP for clinic registration/login
export const sendClinicOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await VerificationCode.findOneAndUpdate(
      { email, type: 'clinic_email_verification' },
      {
        email,
        code: otp,
        type: 'clinic_email_verification',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        isUsed: false
      },
      { upsert: true, new: true }
    );
    await sendVerificationEmail(email, otp);
    res.json({ success: true, message: 'OTP sent to clinic email', data: { email, expiresIn: 600 } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send OTP.' });
  }
};

// Verify OTP and create clinic account
export const verifyClinicOTP = async (req, res) => {
  try {
    const { email, code, name, imageUrl, address, phone } = req.body;
    const verificationRecord = await VerificationCode.findOne({
      email,
      code,
      type: 'clinic_email_verification',
      expiresAt: { $gt: new Date() }
    });
    if (!verificationRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    let clinic = await Clinic.findOne({ email });
    if (!clinic) {
      clinic = new Clinic({ name, email, image: imageUrl, address, phone });
      await clinic.save();
    }
    verificationRecord.isUsed = true;
    await verificationRecord.save();
    const token = generateToken(clinic._id);
    res.json({ success: true, message: 'Clinic verified and account created', data: { token, clinic } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify OTP.' });
  }
};

// Clinic login (email only)
export const clinicLogin = async (req, res) => {
  try {
    const { email } = req.body;
    const clinic = await Clinic.findOne({ email });
    if (!clinic) {
      return res.status(404).json({ success: false, message: 'Clinic not found' });
    }
    const token = generateToken(clinic._id);
    res.json({ success: true, message: 'Clinic login successful', data: { token, clinic } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Clinic login failed.' });
  }
};
