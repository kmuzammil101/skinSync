import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import Appointment from './models/Appointment.js';
import Clinic from './models/Clinic.js';
import ClinicTransaction from './models/ClinicTransaction.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import notificationRoutes from './routes/notifications.js';
import homeRoutes from './routes/home.js';
import treatmentRoutes from './routes/treatments.js';
import appointmentRoutes from './routes/appointments.js';
import clinicRoutes from './routes/Clinic/clinics.js';
import saveRoutes from "./routes/save.js"
import clinicAuthRoutes from './routes/Clinic/clinicAuth.js';
import adminAuthRoutes from './routes/Admin/adminAuth.js';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' });

// Webhook endpoint must be defined before the body parser that would consume the raw body
app.post(
  '/api/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Respond early to Stripe
    res.json({ received: true });

    try {
      switch (event.type) {
        // -------------------------------
        // ✅ 1. Payment succeeded
        // -------------------------------
        case 'payment_intent.succeeded': {
          const pi = event.data.object;

          // 🧩 ADDED: Check metadata for booking info (when no Appointment yet)
          const { userId, clinicId, treatmentId, date, time, appointmentId } =
            pi.metadata || {};

          // Find appointment by PaymentIntent if it already exists
          let appt = await Appointment.findOne({
            stripePaymentIntentId: pi.id,
          });

          // 🧩 ADDED: If appointment doesn’t exist (you create it *after* payment)
          if (!appt && clinicId && treatmentId && userId) {
            appt = await Appointment.create({
              userId,
              clinicId,
              treatmentId,
              date: new Date(date),
              time,
              status: 'confirmed',
              amount: pi.amount_received || pi.amount,
              currency: pi.currency || 'usd',
              stripePaymentIntentId: pi.id,
              paymentStatus: 'paid',
            });
          }

          if (!appt) break;

          // Update payment + confirmation if exists
          appt.paymentStatus = 'paid';
          appt.status = 'confirmed';
          await appt.save();

          // Record a platform transaction (admin received funds)
          const existingTxn = await ClinicTransaction.findOne({
            paymentIntentId: pi.id,
          });
          const amountReceived = pi.amount_received || pi.amount || appt.amount;
          if (!existingTxn) {
            await ClinicTransaction.create({
              clinicId: appt.clinicId,
              type: 'platform_receipt',
              amount: amountReceived,
              currency: appt.currency || 'usd',
              description: `Platform received payment for Appointment ${appt._id}`,
              appointmentId: appt._id,
              paymentIntentId: pi.id,
            });
          }

          // Record hold (funds awaiting admin release)
          await ClinicTransaction.create({
            clinicId: appt.clinicId,
            type: 'hold',
            amount: amountReceived,
            currency: appt.currency || 'usd',
            description: `Funds on hold for Appointment ${appt._id}`,
            appointmentId: appt._id,
            paymentIntentId: pi.id,
            visible: false,
          });

          // 🧩 ADDED: Optional log for debugging successful webhook
          console.log(`✅ Payment succeeded, Appointment ${appt._id} confirmed.`);
          break;
        }

        // -------------------------------
        // ⚠️ Payment failed
        // -------------------------------
        case 'payment_intent.payment_failed': {
          const pi = event.data.object;
          const appt = await Appointment.findOne({
            stripePaymentIntentId: pi.id,
          });
          if (appt) {
            appt.paymentStatus = 'failed';
            appt.status = 'pending';
            await appt.save();
          }
          break;
        }

        // -------------------------------
        // 💸 Refund issued
        // -------------------------------
        case 'charge.refunded': {
          const charge = event.data.object;
          const paymentIntentId =
            charge.payment_intent || charge.metadata?.payment_intent || null;
          let appt = null;

          if (paymentIntentId) {
            appt = await Appointment.findOne({
              stripePaymentIntentId: paymentIntentId,
            });
          }

          if (appt) {
            const clinic = await Clinic.findById(appt.clinicId);
            if (clinic) {
              const existingRefund = await ClinicTransaction.findOne({
                stripeChargeId: charge.id,
                type: 'debit',
              });
              if (!existingRefund) {
                await ClinicTransaction.create({
                  clinicId: clinic._id,
                  type: 'debit',
                  amount: charge.amount_refunded,
                  currency: charge.currency,
                  description:
                    'Refund issued to patient (reversed from held funds/wallet)',
                  stripeChargeId: charge.id,
                });

                if ((clinic.heldBalance || 0) >= charge.amount_refunded) {
                  clinic.heldBalance =
                    (clinic.heldBalance || 0) - charge.amount_refunded;
                } else {
                  clinic.walletBalance =
                    (clinic.walletBalance || 0) - charge.amount_refunded;
                }
                await clinic.save();
              }
            }
          } else {
            const connectedAccountId =
              event.account || charge.transfer_data?.destination;
            const clinic = await Clinic.findOne({
              stripeAccountId: connectedAccountId,
            });
            if (!clinic) break;

            const existingRefund = await ClinicTransaction.findOne({
              stripeChargeId: charge.id,
              type: 'debit',
            });
            if (!existingRefund) {
              await ClinicTransaction.create({
                clinicId: clinic._id,
                type: 'debit',
                amount: charge.amount_refunded,
                currency: charge.currency,
                description: 'Refund issued to patient',
                stripeChargeId: charge.id,
              });

              clinic.walletBalance =
                (clinic.walletBalance || 0) - charge.amount_refunded;
              await clinic.save();
            }
          }
          break;
        }

        // -------------------------------
        // 🏦 Payout to clinic’s bank
        // -------------------------------
        case 'payout.paid': {
          const payout = event.data.object;
          const connectedAccountId = event.account || payout.destination;
          const clinic = await Clinic.findOne({
            stripeAccountId: connectedAccountId,
          });
          if (!clinic) break;

          const existingPayout = await ClinicTransaction.findOne({
            stripePayoutId: payout.id,
          });
          if (!existingPayout) {
            await ClinicTransaction.create({
              clinicId: clinic._id,
              type: 'debit',
              amount: payout.amount,
              currency: payout.currency,
              description: 'Stripe automatic payout to bank',
              stripePayoutId: payout.id,
            });

            clinic.walletBalance =
              (clinic.walletBalance || 0) - payout.amount;
            await clinic.save();
          }
          break;
        }

        // -------------------------------
        // ℹ️ Ignore others
        // -------------------------------
        default:
          console.log(`ℹ️ Ignored event: ${event.type}`);
          break;
      }
    } catch (err) {
      console.error('❌ Error processing webhook:', {
        type: event?.type,
        message: err.message,
        stack: err.stack,
      });
    }
  }
);



// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.resolve('uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skinsync', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/treatments', treatmentRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/save', saveRoutes)
//for clinics
app.use('/api/clinics', clinicRoutes);
app.use('/api/clinic-auth', clinicAuthRoutes);
app.use('/api/admin-auth', adminAuthRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'SkinSync API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
