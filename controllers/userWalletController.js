import User from '../models/User.js';
import UserTransaction from '../models/UserTransaction.js';

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

    res.json({
      success: true,
      data: {
        transactions,
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
