import nodemailer from 'nodemailer';

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send verification email
export const sendVerificationEmail = async (email, code) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"SkinSync AI" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - SkinSync AI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">SkinSync AI</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your AI-Powered Skincare Companion</p>
          </div>
          
          <div style="padding: 40px 20px; background: #f8f9fa;">
            <h2 style="color: #333; text-align: center; margin-bottom: 30px;">Verify Your Email Address</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              Thank you for signing up with SkinSync AI! To complete your registration, please verify your email address using the code below:
            </p>
            
            <div style="background: white; border: 2px solid #e9ecef; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
              <h3 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">Your Verification Code</h3>
              <div style="background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 6px; padding: 20px; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 4px;">${code}</span>
              </div>
              <p style="color: #999; font-size: 14px; margin: 0;">This code will expire in 10 minutes</p>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              If you didn't create an account with SkinSync AI, please ignore this email.
            </p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              © 2024 SkinSync AI. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', result.messageId);
    return result;

  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

// Send welcome email
export const sendWelcomeEmail = async (email, name) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"SkinSync AI" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to SkinSync AI!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to SkinSync AI!</h1>
            <p style="color: white; margin: 10px 0 0 0; font-size: 16px;">Your AI-Powered Skincare Journey Starts Here</p>
          </div>
          
          <div style="padding: 40px 20px; background: #f8f9fa;">
            <h2 style="color: #333; text-align: center; margin-bottom: 30px;">Hello ${name}!</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              Welcome to SkinSync AI! We're excited to have you join our community of skincare enthusiasts. 
              Get ready to discover personalized skincare recommendations powered by artificial intelligence.
            </p>
            
            <div style="background: white; border-radius: 8px; padding: 30px; margin: 30px 0; border-left: 4px solid #667eea;">
              <h3 style="color: #333; margin: 0 0 20px 0; font-size: 18px;">What's Next?</h3>
              <ul style="color: #666; font-size: 16px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Complete your profile to get personalized recommendations</li>
                <li>Enable notifications for skincare tips and reminders</li>
                <li>Start your AI-powered skin analysis journey</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" 
                 style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Get Started
              </a>
            </div>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              © 2024 SkinSync AI. All rights reserved.
            </p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', result.messageId);
    return result;

  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};
