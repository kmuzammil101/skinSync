import User from '../models/User.js';
import UserTransaction from '../models/UserTransaction.js';

// GET /api/user/wallet?page=1&limit=20
export const getUserWallet = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId).select('walletBalance heldBalance');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Only show visible transactions
    const [transactions, total] = await Promise.all([
      UserTransaction.find({ userId, visible: { $ne: false } })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      UserTransaction.countDocuments({ userId })
    ]);

    res.json({
      success: true,
      data: {
        walletBalance: user.walletBalance || 0,
        heldBalance: user.heldBalance || 0,
        transactions,
        page,
        limit,
        totalTransactions: total
      }
    });

  } catch (err) {
    console.error('Get user wallet error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
