import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test passwordless authentication endpoints
app.post('/api/auth/send-otp', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is required'
    });
  }

  // Simulate OTP generation
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  console.log(`📧 OTP for ${email}: ${otp}`);
  
  res.json({
    success: true,
    message: 'OTP sent successfully (check console for OTP)',
    data: {
      email,
      otp, // Only for testing - remove in production
      expiresIn: 600
    }
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({
      success: false,
      message: 'Email and code are required'
    });
  }

  // Simulate OTP verification
  if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid OTP format'
    });
  }

  // Simulate user check
  const isNewUser = Math.random() > 0.5; // Random for testing
  
  if (isNewUser) {
    res.json({
      success: true,
      message: 'OTP verified successfully. Please complete your profile.',
      data: {
        isNewUser: true,
        requiresProfileCompletion: true
      }
    });
  } else {
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        isNewUser: false,
        token: 'mock-jwt-token',
        requiresProfileCompletion: false
      }
    });
  }
});

app.post('/api/auth/complete-profile', (req, res) => {
  const { name, phone, location, bio } = req.body;
  const { email } = req.query;
  
  if (!email || !name) {
    return res.status(400).json({
      success: false,
      message: 'Email and name are required'
    });
  }

  res.json({
    success: true,
    message: 'Profile completed successfully',
    data: {
      token: 'mock-jwt-token',
      user: {
        email,
        name,
        phone,
        location,
        bio,
        isEmailVerified: true
      }
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'SkinSync Passwordless API Test Server',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Passwordless Test Server running on port ${PORT}`);
  console.log(`📡 Test endpoints:`);
  console.log(`   POST /api/auth/send-otp`);
  console.log(`   POST /api/auth/verify-otp`);
  console.log(`   POST /api/auth/complete-profile`);
  console.log(`   GET  /api/health`);
});
