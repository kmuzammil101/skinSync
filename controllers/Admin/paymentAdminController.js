import mongoose from 'mongoose';
import Clinic from '../../models/Clinic.js';
import ClinicTransaction from '../../models/ClinicTransaction.js';
import UserTransaction from '../../models/UserTransaction.js';
import stripe from 'stripe';
import Appointment from '../../models/Appointment.js';
const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);

export const releaseHeldPayment = async (req, res) => {
  try {
    const { transactionId } = req.params; 
    let { amount, imageForProof } = req.body; // amount in dollars

    if (!transactionId || !mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ success: false, message: 'Invalid transaction ID' });
    }

    if (amount === undefined || amount === null) {
      return res.status(400).json({ success: false, message: 'Amount is required' });
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    // 🔹 Stripe expects cents — store actual dollars but convert for Stripe if needed
    const amountInCents = Math.round(amount * 100);

    const transaction = await ClinicTransaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const clinic = await Clinic.findById(transaction.clinicId);
    if (!clinic) {
      return res.status(404).json({ success: false, message: 'Clinic not found' });
    }

    if (transaction.type !== 'hold') {
      return res.status(400).json({
        success: false,
        message: 'Only held transactions can be released',
      });
    }

    // 🔹 Store amount in actual units
    transaction.amount = amount; 
    transaction.type = 'release';
    transaction.visible = true;
    transaction.description = `Admin released $${amount} from held funds to clinic wallet.`;
    transaction.imageForProof = imageForProof || transaction.imageForProof || '';
    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction updated successfully as released',
      data: transaction,
    });

  } catch (err) {
    console.error('Release held error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + err.message,
    });
  }
};


export const refundUser = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ success: false, message: 'Invalid appointment ID' });
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment || !appointment.stripePaymentIntentId) {
      return res.status(404).json({ success: false, message: 'Appointment or payment not found' });
    }

    if (appointment.status === 'refunded') {
      return res.status(400).json({ success: false, message: 'Already refunded' });
    }

    // 🔹 Refund via Stripe (cents)
    const refund = await stripeClient.refunds.create({
      payment_intent: appointment.stripePaymentIntentId,
    });

    appointment.status = 'refunded';
    await appointment.save();

    // 🔹 Convert refund amount to actual currency
    const refundAmount = (refund.amount || appointment.amount || 0) / 100;
    const refundCurrency = refund.currency || appointment.currency || 'usd';

    // 🔹 Clinic transaction (record refund)
    try {
      await ClinicTransaction.create({
        clinicId: appointment.clinicId,
        type: 'cancelled',
        amount: refundAmount, // ✅ store actual unit
        currency: refundCurrency,
        description: `Refund of $${refundAmount} issued to patient (appointment ${appointment._id})`,
        appointmentId: appointment._id,
        paymentIntentId: appointment.stripePaymentIntentId,
        stripeChargeId: refund.charge || undefined,
        visible: true,
      });
    } catch (e) {
      console.error('Failed to record clinic transaction for refund:', e.message);
    }

    // 🔹 User transaction (visible to user)
    try {
      const existingUserRefund = await UserTransaction.findOne({
        paymentIntentId: appointment.stripePaymentIntentId,
        type: 'refund'
      });
      if (!existingUserRefund) {
        await UserTransaction.create({
          userId: appointment.userId,
          type: 'refund',
          amount: refundAmount, // ✅ store actual unit
          currency: refundCurrency,
          description: `Refund issued for Appointment ${appointment._id}`,
          appointmentId: appointment._id,
          paymentIntentId: appointment.stripePaymentIntentId,
          stripeChargeId: refund.charge || undefined,
          visible: true,
        });
      }
    } catch (e) {
      console.error('Failed to create UserTransaction for refund:', e.message);
    }

    res.json({ success: true, message: 'Refund processed successfully', data: refund });
  } catch (err) {
    console.error('Refund error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

