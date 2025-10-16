import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import Appointment from './models/Appointment.js';
import Clinic from './models/Clinic.js';
import ClinicTransaction from './models/ClinicTransaction.js';
import UserTransaction from './models/UserTransaction.js';
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
import adminPaymentRoutes from './routes/Admin/paymentsAdmin.js';
import path from 'path';
//ignore
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

          // 🧩 Extract metadata (for appointments created after payment)
          const { userId, clinicId, treatmentId, date, time, appointmentId } = pi.metadata || {};

          // 💰 Stripe sends amounts in cents → convert to dollars
          const amountReceivedCents = pi.amount_received || pi.amount || 0;
          const amountReceived = amountReceivedCents / 100; // now in dollars

          // 🧩 Find appointment by PaymentIntent
          let appt = await Appointment.findOne({ stripePaymentIntentId: pi.id });

          // 🧩 If appointment doesn’t exist, create it (from metadata)
          if (!appt && clinicId && treatmentId && userId) {
            appt = await Appointment.create({
              userId,
              clinicId,
              treatmentId,
              date: new Date(date),
              time,
              status: 'confirmed',
              amount: amountReceived, // ✅ stored in dollars
              currency: pi.currency || 'usd',
              stripePaymentIntentId: pi.id,
              paymentStatus: 'paid',
            });
          }

          if (!appt) break;

          // 🧾 Update appointment status
          appt.paymentStatus = 'paid';
          appt.status = 'confirmed';
          await appt.save();

          // 💰 Record platform transaction (admin received funds)
          const existingTxn = await ClinicTransaction.findOne({ paymentIntentId: pi.id });
          if (!existingTxn) {
            await ClinicTransaction.create({
              clinicId: appt.clinicId,
              type: 'hold',
              amount: amountReceived, // ✅ in dollars
              currency: appt.currency || 'usd',
              description: `Platform received payment for Appointment ${appt._id}`,
              appointmentId: appt._id,
              paymentIntentId: pi.id,
              visible: false,
            });
          }

          // 👤 Record a user-facing transaction (platform charged the user)
          try {
            const existingUserTxn = await UserTransaction.findOne({ paymentIntentId: pi.id });
            if (!existingUserTxn) {
              // Try to get readable names
              let clinicName = 'Clinic';
              let treatmentName = 'Treatment';
              try {
                const clinic = await Clinic.findById(appt.clinicId).select('name');
                if (clinic?.name) clinicName = clinic.name;
              } catch { }

              try {
                const Treatment = (await import('./models/Treatment.js')).default;
                const treatment = await Treatment.findById(appt.treatmentId).select('name');
                if (treatment?.name) treatmentName = treatment.name;
              } catch { }

              await UserTransaction.create({
                userId: appt.userId,
                type: 'platform_charge',
                amount: amountReceived, // ✅ in dollars
                currency: appt.currency || 'usd',
                description: `Charged $${amountReceived.toFixed(2)} for ${treatmentName} at ${clinicName} (Appointment ${appt._id})`,
                appointmentId: appt._id,
                paymentIntentId: pi.id,
                visible: true,
              });
            }
          } catch (e) {
            console.error('Failed to create UserTransaction for payment_intent.succeeded:', e.message);
          }

          // 💼 Record hold (funds awaiting admin release) - idempotent + update clinic balance
          try {
            const existingHold = await ClinicTransaction.findOne({ paymentIntentId: pi.id, type: 'hold' });
            if (!existingHold) {
              await ClinicTransaction.create({
                clinicId: appt.clinicId,
                type: 'hold',
                amount: amountReceived, // ✅ in dollars
                currency: appt.currency || 'usd',
                description: `Funds on hold for Appointment ${appt._id}`,
                appointmentId: appt._id,
                paymentIntentId: pi.id,
                visible: false,
              });

              // Increment clinic heldBalance in dollars
              try {
                const clinic = await Clinic.findById(appt.clinicId);
                if (clinic) {
                  clinic.heldBalance = (clinic.heldBalance || 0) + amountReceived;
                  await clinic.save();
                }
              } catch (e) {
                console.error('Failed to update clinic heldBalance:', e.message);
              }
            }
          } catch (e) {
            console.error('Failed to create hold ClinicTransaction:', e.message);
          }

          console.log(`✅ Payment succeeded — Appointment ${appt._id} confirmed, $${amountReceived.toFixed(2)} received.`);
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
          const paymentIntentId = charge.payment_intent || charge.metadata?.payment_intent || null;

          try {
            // 1️⃣ Find the related appointment
            let appointment = null;
            if (paymentIntentId) {
              appointment = await Appointment.findOne({ stripePaymentIntentId: paymentIntentId });
            }

            if (!appointment) {
              console.log('⚠️ charge.refunded: No appointment found for payment_intent', paymentIntentId);
              break;
            }

            // 2️⃣ Idempotency — skip if already refunded
            const existingClinicTxn = await ClinicTransaction.findOne({
              paymentIntentId,
              type: { $in: ['debit', 'cancelled'] }, // support both naming conventions
            });

            if (existingClinicTxn) {
              console.log(`ℹ️ Refund already handled for ${paymentIntentId}, skipping webhook.`);
              break;
            }

            // 3️⃣ Create clinic transaction (refund/debit entry)
            await ClinicTransaction.create({
              clinicId: appointment.clinicId,
              type: 'cancelled',
              amount: charge.amount_refunded || 0,
              currency: charge.currency || appointment.currency || 'usd',
              description: `Refund issued to patient for Appointment ${appointment._id}`,
              appointmentId: appointment._id,
              paymentIntentId,
              stripeChargeId: charge.id,
              visible: true,
            });

            // 4️⃣ Create user refund transaction if not exists
            const existingUserRefund = await UserTransaction.findOne({
              paymentIntentId,
              type: 'refund',
            });

            if (!existingUserRefund) {
              await UserTransaction.create({
                userId: appointment.userId,
                type: 'refund',
                amount: charge.amount_refunded || appointment.amount || 0,
                currency: charge.currency || appointment.currency || 'usd',
                description: `Refund issued for Appointment ${appointment._id}`,
                appointmentId: appointment._id,
                paymentIntentId,
                stripeChargeId: charge.id,
                visible: true,
              });
            }

            // 5️⃣ Update appointment status if not already refunded
            if (appointment.status !== 'refunded') {
              appointment.status = 'refunded';
              appointment.paymentStatus = 'refunded';
              await appointment.save();
            }

            console.log(`✅ charge.refunded processed for Appointment ${appointment._id}`);
          } catch (err) {
            console.error('❌ Error handling charge.refunded webhook:', err);
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

//for admins
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/admin-payment', adminPaymentRoutes);

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
