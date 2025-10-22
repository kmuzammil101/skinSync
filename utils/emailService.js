import admin from 'firebase-admin';
admin.initializeApp();

const db = admin.firestore();

export const sendVerificationEmail = async (email, code) => {
  try {
    await db.collection('mail').add({
      to: [email],
      message: {
        subject: 'Verify Your Email - SkinSync AI',
        html: `
          <!-- your full HTML with ${
            code
          } inserted -->
        `
      }
    });
    console.log('Queued verification email to:', email);
  } catch (error) {
    console.error('Error queueing verification email:', error);
    throw error;
  }
};

export const sendWelcomeEmail = async (email, name) => {
  try {
    await db.collection('mail').add({
      to: [email],
      message: {
        subject: 'Welcome to SkinSync AI!',
        html: `
          <!-- your welcome HTML with ${name} inserted -->
        `
      }
    });
    console.log('Queued welcome email to:', email);
  } catch (error) {
    console.error('Error queueing welcome email:', error);
    throw error;
  }
};
