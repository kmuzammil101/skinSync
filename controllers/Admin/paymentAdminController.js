import Clinic from "../../models/Clinic";

// Admin endpoint: release held payments for a clinic
export const releaseHeldPayment = async (req, res) => {
  try {
    const { id } = req.params; // clinic id
    const { amount } = req.body; // optional amount to release (in cents). If omitted, release full heldBalance

    const clinic = await Clinic.findById(id);
    if (!clinic) return res.status(404).json({ success: false, message: 'Clinic not found' });

    const held = clinic.heldBalance || 0;
    if (held <= 0) return res.status(400).json({ success: false, message: 'No held funds to release' });

    const releaseAmount = amount && amount > 0 && amount <= held ? amount : held;

    // Decrease heldBalance and increase walletBalance (clinic sees funds on their app wallet)
    clinic.heldBalance = held - releaseAmount;
    clinic.walletBalance = (clinic.walletBalance || 0) + releaseAmount;
    await clinic.save();

    // Record release transaction
    const txn = await ClinicTransaction.create({
      clinicId: clinic._id,
      type: 'release',
      amount: releaseAmount,
      currency: 'usd',
      description: `Admin released held funds of ${releaseAmount} cents to clinic wallet`,
    });

    // Optionally, auto-transfer to connected Stripe account when releasing (if configured)
    // if (process.env.AUTO_TRANSFER_ON_RELEASE === 'true' && clinic.stripeAccountId) {
    //   try {
    //     // Create a transfer from platform to connected account
    //     const transfer = await stripe.transfers.create({
    //       amount: releaseAmount,
    //       currency: 'usd',
    //       destination: clinic.stripeAccountId,
    //       metadata: { clinicId: clinic._id.toString(), clinicTransactionId: txn._id.toString() }
    //     });

    //     // Record transfer id on transaction and also mark as credit -> then debit from wallet mirror
    //     txn.stripeTransferId = transfer.id;
    //     txn.type = 'credit';
    //     txn.description += `; transferred to Stripe account ${clinic.stripeAccountId}`;
    //     await txn.save();

    //     // Decrease walletBalance because money moved out to Stripe (mirror)
    //     clinic.walletBalance = (clinic.walletBalance || 0) - releaseAmount;
    //     await clinic.save();
    //   } catch (e) {
    //     console.error('Auto transfer on release failed', e.message);
    //   }
    // }

    res.json({ success: true, message: 'Released held funds', data: { clinic, transaction: txn } });
  } catch (err) {
    console.error('Release held error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};