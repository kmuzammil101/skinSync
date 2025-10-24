import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER; // e.g. "+1234567890"

// Initialize Twilio client
const client = twilio(accountSid, authToken);

/**
 * Send SMS using Twilio
 * @param {string} to - Recipient phone number (with country code, e.g. +923001234567)
 * @param {string} message - Message text to send
 * @returns {Promise<void>}
 */
export const sendSMS = async (to, message) => {
  try {
    if (!to || !message) {
      throw new Error('Phone number and message are required');
    }

    const sms = await client.messages.create({
      body: message,
      from: fromPhone,
      to
    });

    console.log(`✅ SMS sent successfully to ${to}. SID: ${sms.sid}`);
    return sms;
  } catch (error) {
    console.error('❌ Error sending SMS via Twilio:', error.message);
    throw new Error('Failed to send SMS');
  }
};
