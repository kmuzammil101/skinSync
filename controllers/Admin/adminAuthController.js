import Admin from '../../models/Admin.js';
import jwt from 'jsonwebtoken';

const generateToken = (adminId) => {
  return jwt.sign({ adminId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

export const adminSignup = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ success: false, message: 'Admin already exists' });

    const admin = await Admin.create({ email: email.toLowerCase(), password, role });
    const token = generateToken(admin._id);

    res.status(201).json({ success: true, data: { admin: { id: admin._id, email: admin.email, role: admin.role, token } } });
  } catch (err) {
    console.error('Admin signup error', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = generateToken(admin._id);
    res.json({ success: true, data: { admin: { id: admin._id, email: admin.email, role: admin.role, token } } });
  } catch (err) {
    console.error('Admin login error', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
