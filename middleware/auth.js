import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Admin from '../models/Admin.js';

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    req.user = {
      userId: user._id,
      email: user.email
    };
    console.log(req.user.userId,">>>>>>>>>>>>>>>>>>>>>>")
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const authorizeAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
      });
    }

    // 🔐 Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach decoded data to req.user
    // 🧠 Look up admin by email or role
    const admin = await Admin.findById({ _id: decoded.adminId });
    console.log('authorizeAdmin - decoded:', decoded, 'admin found:', !!admin);
    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required',
      });
    }

    // ✅ Optionally, check role if you have different levels
    if (!['admin', 'superadmin'].includes(admin.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient privileges',
      });
    }

    // Everything OK — proceed
    next();
  } catch (err) {
    console.error('authorizeAdmin error:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    res.status(500).json({ success: false, message: 'Invalid or expired token' });
  }
};
