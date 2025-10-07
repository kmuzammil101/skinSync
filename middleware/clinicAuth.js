import jwt from 'jsonwebtoken';
import Clinic from '../models/Clinic.js';

export const authenticateClinicToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
      return res.status(401).json({ success: false, message: 'Clinic access token required' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const clinic = await Clinic.findById(decoded.clinicId);
    if (!clinic) {
      return res.status(401).json({ success: false, message: 'Invalid or expired clinic token' });
    }
    req.clinic = { clinicId: clinic._id, email: clinic.email };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired clinic token' });
  }
};
