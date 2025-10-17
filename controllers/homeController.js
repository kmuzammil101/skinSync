import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Treatment from '../models/Treatment.js';
import Clinic from '../models/Clinic.js';
import Promotion from '../models/Promotion.js';

// Get home page data
export const getHomeData = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user data
    const user = await User.findById(userId).select('name profileImage loyaltyPoints');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1️⃣ Today's appointments
    const todaysAppointments = await Appointment.find({
      userId,
      status: { $in: ['pending', 'confirmed'] },
      date: { $gte: todayStart, $lte: todayEnd }
    })
    .populate('clinicId', 'name image')
    .populate('treatmentId', 'name image')
    .sort({ date: 1, time: 1 });

    // 2️⃣ Upcoming/future appointments (after today, limit 3)
    const upcomingAppointments = await Appointment.find({
      userId,
      status: { $in: ['pending', 'confirmed'] },
      date: { $gt: todayEnd }
    })
    .populate('clinicId', 'name image')
    .populate('treatmentId', 'name image')
    .sort({ date: 1, time: 1 })
    .limit(3);

    // Combine today and upcoming appointments
    const combinedAppointments = [
      ...todaysAppointments.map(appt => ({ ...appt.toObject(), appointmentType: 'today' })),
      ...upcomingAppointments.map(appt => ({ ...appt.toObject(), appointmentType: 'upcoming' }))
    ];

    // Format appointments for frontend
    const formattedAppointments = combinedAppointments.map(appointment => ({
      id: appointment._id,
      treatmentName: appointment.treatmentId.name,
      clinicName: appointment.clinicId.name,
      clinicImage: appointment.clinicId.image,
      treatmentImage: appointment.treatmentId.image,
      date: appointment.date,
      time: appointment.time,
      status: appointment.status,
      type: appointment.appointmentType // 'today' or 'upcoming'
    }));

    // Get active promotions
    const activePromotions = await Promotion.find({
      isActive: true,
      validTill: { $gte: new Date() }
    })
    .populate('clinicId', 'name')
    .populate('treatmentId', 'name image')
    .sort({ createdAt: -1 })
    .limit(5);

    const formattedPromotions = activePromotions.map(promotion => ({
      id: promotion._id,
      title: promotion.title,
      clinicName: promotion.clinicId.name,
      treatmentName: promotion.treatmentId.name,
      treatmentImage: promotion.treatmentId.image,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      validTill: promotion.validTill,
      image: promotion.image
    }));

    // Loyalty points
    const maxPoints = 1000;
    const currentPoints = user.loyaltyPoints || 0;
    const pointsPercentage = Math.round((currentPoints / maxPoints) * 100);

    // Pending reminders (next 24h)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const pendingReminders = await Appointment.find({
      userId,
      status: 'confirmed',
      date: { 
        $gte: new Date(),
        $lte: tomorrow
      }
    })
    .populate('clinicId', 'name')
    .populate('treatmentId', 'name image')
    .limit(1);

    let reminder = null;
    if (pendingReminders.length > 0) {
      const appointment = pendingReminders[0];
      reminder = {
        id: appointment._id,
        treatmentName: appointment.treatmentId.name,
        clinicName: appointment.clinicId.name,
        treatmentImage: appointment.treatmentId.image,
        date: appointment.date,
        time: appointment.time,
        questions: [
          {
            id: 1,
            question: "Have you consumed alcohol in the last 24-48 hours?",
            options: ["Yes", "No"]
          }
        ]
      };
    }

    res.json({
      success: true,
      data: {
        user: {
          name: user.name,
          profileImage: user.profileImage
        },
        loyalty: {
          currentPoints,
          maxPoints,
          percentage: pointsPercentage,
          message: `Earn up to $250/month!`,
          redeemText: "Redeem Points"
        },
        upcomingAppointments: {
          title: "Your Next Appointment",
          appointments: formattedAppointments
        },
        promotions: {
          title: "Promotions & Discounts",
          promotions: formattedPromotions
        },
        reminder
      }
    });

  } catch (error) {
    console.error('Get home data error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


// Get user loyalty points
export const getLoyaltyPoints = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId).select('loyaltyPoints');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const maxPoints = 1000;
    const currentPoints = user.loyaltyPoints || 0;
    const pointsPercentage = Math.round((currentPoints / maxPoints) * 100);

    res.json({
      success: true,
      data: {
        currentPoints,
        maxPoints,
        percentage: pointsPercentage,
        message: `Earn up to $250/month!`
      }
    });

  } catch (error) {
    console.error('Get loyalty points error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Add loyalty points
export const addLoyaltyPoints = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { points, reason } = req.body;

    if (!points || points <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid points amount is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.loyaltyPoints = (user.loyaltyPoints || 0) + points;
    await user.save();

    res.json({
      success: true,
      message: 'Points added successfully',
      data: {
        currentPoints: user.loyaltyPoints,
        addedPoints: points,
        reason: reason || 'Points earned'
      }
    });

  } catch (error) {
    console.error('Add loyalty points error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
