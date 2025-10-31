import User from '../models/User.js';
import UserTransaction from '../models/UserTransaction.js';
import Promotion from '../models/Promotion.js';

// GET /api/user/wallet?page=1&limit=20
export const getUserWallet = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '20')));
    const skip = (page - 1) * limit;

    const user = await User.findById(userId).select('walletBalance heldBalance');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Fetch transactions for this user, newest first
    const transactions = await UserTransaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await UserTransaction.countDocuments({ userId: user._id });

    // Fetch active promotions that are currently valid
    const currentDate = new Date();
    const promotions = await Promotion.find({
      isActive: true,
      validFrom: { $lte: currentDate },
      validTill: { $gte: currentDate }
    })
      .populate('clinicId', 'name')
      .populate('treatmentId', 'name price')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        walletBalance: user.walletBalance,
        heldBalance: user.heldBalance,
        transactions,
        promotions,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalTransactions: total
        }
      }
    });
  } catch (err) {
    console.error('Get user wallet error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
