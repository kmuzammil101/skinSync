import Clinic from '../models/Clinic.js';
import ClinicTransaction from '../models/ClinicTransaction.js';

export const releaseHeldPayment = async (req, res) => {
  try {
    const { id } = req.params; // clinic id
    let { amount } = req.body; // amount in dollars

    const clinic = await Clinic.findById(id);
    if (!clinic) {
      return res.status(404).json({ success: false, message: 'Clinic not found' });
    }

    const held = clinic.heldBalance || 0;
    if (held <= 0) {
      return res.status(400).json({ success: false, message: 'No held funds to release' });
    }

    // Convert amount from dollars to cents
    if (amount && typeof amount === 'number') {
      amount = Math.round(amount * 100);
    }

    const releaseAmount = amount && amount > 0 && amount <= held ? amount : held;

    // Update balances
    clinic.heldBalance = held - releaseAmount;
    clinic.walletBalance = (clinic.walletBalance || 0) + releaseAmount;
    await clinic.save();

    // Record the release transaction
    const txn = await ClinicTransaction.create({
      clinicId: clinic._id,
      type: 'release',
      amount: releaseAmount,
      currency: 'usd',
      description: `Admin released ${releaseAmount} cents from held funds to clinic wallet.`,
      visible: true, // ✅ Always visible
    });

    res.json({
      success: true,
      message: 'Released held funds successfully',
      data: { clinic, transaction: txn },
    });
  } catch (err) {
    console.error('Release held error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
