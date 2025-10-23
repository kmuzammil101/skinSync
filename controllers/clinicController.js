import Clinic from '../models/Clinic.js';
import Appointment from '../models/Appointment.js';
import Treatment from '../models/Treatment.js';
import User from '../models/User.js';
import { addIsSavedToClinics, addIsSavedToClinic } from '../utils/saveUtils.js';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import ClinicTransaction from '../models/ClinicTransaction.js';
import Promotion from '../models/Promotion.js';
import jwt from 'jsonwebtoken';

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' });

// Get all clinics
export const getClinics = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      minRating,
      location,
      isActive = true
    } = req.query;

    const userId = req.user?.userId; // Get userId if authenticated

    const query = { isActive };

    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by minimum rating
    if (minRating) {
      query.ratingStars = { $gte: parseFloat(minRating) };
    }

    // Filter by location (basic text search)
    if (location) {
      query.address = { $regex: location, $options: 'i' };
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    let clinics = await Clinic.find(query)
      .populate('treatments', 'name treatmentType price image')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Add isSaved field if user is authenticated
    if (userId) {
      clinics = await addIsSavedToClinics(userId, clinics);
    }

    const total = await Clinic.countDocuments(query);

    res.json({
      success: true,
      data: {
        clinics,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalClinics: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get clinics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get clinic by ID
export const getClinicById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId; // Get userId if authenticated

    const clinic = await Clinic.findById(id)
      .populate({
        path: 'treatments',
        select: 'name treatmentType price image description' // only necessary fields
      })
      .populate('userReviews.userId', 'name profileImage');

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    // Add isSaved field if user is authenticated
    let clinicWithSaved = clinic;
    if (userId) {
      clinicWithSaved = await addIsSavedToClinic(userId, clinic);
    }

    res.json({
      success: true,
      data: clinicWithSaved
    });

  } catch (error) {
    console.error('Get clinic by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


const generateToken = (clinicId) => {
  return jwt.sign({ clinicId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Create clinic
export const createClinic = async (req, res) => {
  try {
    const clinicId = req.clinic.clinicId; // ✅ Extract clinic ID from authenticated clinic (middleware)
    const {
      name,
      description,
      image,
      address,
      phone,
      website,
      businessHours,
      coordinates,
      proofOfExpertise,
    } = req.body;

    console.log("Updating clinic with data:");
    console.log(req.body);

    // Validate required fields
    if (!name || !description || !image || !address || !phone) {
      return res.status(400).json({
        success: false,
        message: 'name, description, image, address, and phone are required',
      });
    }

    // Update existing clinic
    const updatedClinic = await Clinic.findByIdAndUpdate(
      clinicId,
      {
        name,
        description,
        image,
        address,
        phone,
        website,
        businessHours,
        coordinates,
        proofOfExpertise,
        isClinicCreated: true,
      },
      { new: true } // Return the updated document
    );

    if (!updatedClinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found',
      });
    }

    // Generate token and attach it to the clinic object
    const token = generateToken(updatedClinic._id);
    const clinicWithToken = {
      ...updatedClinic.toObject(),
      token,
    };

    return res.status(200).json({
      success: true,
      message: 'Clinic updated successfully',
      data: {
        clinic: clinicWithToken, // token included inside clinic object
      },
    });
  } catch (error) {
    console.error('Update clinic error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};





// Update clinic
export const updateClinic = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const clinic = await Clinic.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('treatments', 'name treatmentType price image');

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    res.json({
      success: true,
      message: 'Clinic updated successfully',
      data: clinic
    });

  } catch (error) {
    console.error('Update clinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete clinic
export const deleteClinic = async (req, res) => {
  try {
    const { id } = req.params;

    const clinic = await Clinic.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    res.json({
      success: true,
      message: 'Clinic deactivated successfully'
    });

  } catch (error) {
    console.error('Delete clinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Add review to clinic
export const addReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { ratingStars, comment } = req.body;

    if (!ratingStars || ratingStars < 1 || ratingStars > 5) {
      return res.status(400).json({
        success: false,
        message: 'Valid rating (1-5) is required'
      });
    }

    const clinic = await Clinic.findById(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    // Check if user already reviewed this clinic
    const existingReview = clinic.userReviews.find(
      review => review.userId.toString() === userId
    );

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this clinic'
      });
    }

    // Add review
    clinic.userReviews.push({
      userId,
      ratingStars,
      comment
    });

    // Calculate new average rating
    await clinic.calculateAverageRating();

    const updatedClinic = await Clinic.findById(id)
      .populate('userReviews.userId', 'name profileImage')
      .populate('treatments', 'name treatmentType price image');

    res.json({
      success: true,
      message: 'Review added successfully',
      data: updatedClinic
    });

  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update review
export const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { ratingStars, comment } = req.body;

    if (!ratingStars || ratingStars < 1 || ratingStars > 5) {
      return res.status(400).json({
        success: false,
        message: 'Valid rating (1-5) is required'
      });
    }

    const clinic = await Clinic.findById(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    // Find and update review
    const reviewIndex = clinic.userReviews.findIndex(
      review => review.userId.toString() === userId
    );

    if (reviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    clinic.userReviews[reviewIndex].ratingStars = ratingStars;
    clinic.userReviews[reviewIndex].comment = comment;

    // Recalculate average rating
    await clinic.calculateAverageRating();

    const updatedClinic = await Clinic.findById(id)
      .populate('userReviews.userId', 'name profileImage')
      .populate('treatments', 'name treatmentType price image');

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: updatedClinic
    });

  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete review
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const clinic = await Clinic.findById(id);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    // Find and remove review
    const reviewIndex = clinic.userReviews.findIndex(
      review => review.userId.toString() === userId
    );

    if (reviewIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    clinic.userReviews.splice(reviewIndex, 1);

    // Recalculate average rating
    await clinic.calculateAverageRating();

    const updatedClinic = await Clinic.findById(id)
      .populate('userReviews.userId', 'name profileImage')
      .populate('treatments', 'name treatmentType price image');

    res.json({
      success: true,
      message: 'Review deleted successfully',
      data: updatedClinic
    });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// ---------------------------------
// Stripe Connect: Onboard clinic (Express account) and create account link
// ---------------------------------
export const onboardClinic = async (req, res) => {
  try {
    const { clinicId, name, email, country = 'US' } = req.body;
    if (!clinicId || !name || !email) return res.status(400).json({ success: false, message: 'clinicId, name and email are required' });

    const clinic = await Clinic.findById(clinicId);
    if (!clinic) return res.status(404).json({ success: false, message: 'Clinic not found' });

    // Create connected account
    const account = await stripe.accounts.create({
      type: 'express',
      country,
      email,
      business_type: 'company',
      business_profile: { name }
    });

    clinic.stripeAccountId = account.id;
    clinic.accountType = 'express';
    await clinic.save();

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: process.env.STRIPE_ONBOARD_REFRESH_URL || 'https://yourapp.example.com/reauth',
      return_url: process.env.STRIPE_ONBOARD_RETURN_URL || 'https://yourapp.example.com/onboard/success',
      type: 'account_onboarding'
    });

    res.json({ success: true, url: accountLink.url, clinic });
  } catch (err) {
    console.error('Onboard clinic error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

//create discount on treatment

export const discountOnTreatment = async (req, res) => {
  try {
    const clinicId = req.user.clinicId;
    const { treatmentId, discountPercentage } = req.body;
    if (!treatmentId || !discountPercentage) {
      return res.status(400).json({ success: false, message: 'treatmentId and discountPercentage are required' });
    }
    const treatment = await Treatment.findById(treatmentId);
    if (!treatment) {
      return res.status(404).json({ success: false, message: 'Treatment not found' });
    }
    if (treatment.clinicId.toString() !== clinicId) {
      return res.status(403).json({ success: false, message: 'Unauthorized to modify this treatment' });
    }
    treatment.discountPercentage = discountPercentage;
    await treatment.save();
    res.json({ success: true, message: `Discount applied on ${treatment.name} successfully`, treatment });

  } catch (err) {
    console.error('Create discount error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};



export const upcomingAppointmentsOFClinic = async (req, res) => {
  try {
    // clinicId from authenticated clinic user
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ success: false, message: 'Unauthorized: clinicId missing' });

    // Pagination for upcoming list
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit || '20')));
    const skip = (page - 1) * limit;

    // Optional status filter (e.g., pending, confirmed, cancelled)
    const statusFilter = req.query.status;

    // Today's date range (local) — consider clinic timezone improvements later
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Build base query for clinic
    const baseQuery = { clinicId };
    if (statusFilter) baseQuery.status = statusFilter;

    // 1) Fetch today's appointments
    const todaysQuery = {
      ...baseQuery,
      date: { $gte: startOfToday, $lte: endOfToday }
    };

    const todaysAppointments = await Appointment.find(todaysQuery)
      .sort({ time: 1 })
      .populate('userId', 'name profileImage email')
      .populate('treatmentId', 'name price')
      .lean();

    // 2) Fetch upcoming appointments (strictly after today)
    const upcomingQuery = {
      ...baseQuery,
      date: { $gte: new Date(endOfToday.getTime() + 1) }
    };

    const totalUpcoming = await Appointment.countDocuments(upcomingQuery);
    const upcomingAppointments = await Appointment.find(upcomingQuery)
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name profileImage email')
      .populate('treatmentId', 'name price')
      .lean();

    res.json({
      success: true,
      data: {
        clinicId,
        todaysCount: todaysAppointments.length,
        todaysAppointments,
        upcoming: {
          total: totalUpcoming,
          page,
          limit,
          appointments: upcomingAppointments
        }
      }
    });
  } catch (err) {
    console.error("error in upcoming appointments of clinic", err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}


// ---------------------------------
// Get clinic wallet (balance + transactions)
// ---------------------------------
export const getClinicWallet = async (req, res) => {
  try {
    const id = req.clinic.clinicId;
    const clinic = await Clinic.findById(id);
    if (!clinic)
      return res.status(404).json({ success: false, message: 'Clinic not found' });

    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const pageLimit = Math.max(1, Math.min(100, parseInt(limit)));
    const skip = (pageNum - 1) * pageLimit;

    // Base query — only visible transactions of this clinic
    const txQuery = { clinicId: clinic._id };

    // Fetch paginated transactions
    const transactions = await ClinicTransaction.find(txQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageLimit)
      .lean();
    const total = await ClinicTransaction.countDocuments(txQuery);

    // ✅ Total earnings (sum of all 'release' type transactions)
    const totalEarningsAgg = await ClinicTransaction.aggregate([
      { $match: { clinicId: clinic._id, visible: { $ne: false }, type: 'release' } },
      { $group: { _id: null, totalEarnings: { $sum: { $ifNull: ['$amount', 0] } } } }
    ]);
    const totalEarnings = totalEarningsAgg[0]?.totalEarnings || 0;

    // ✅ Today’s earnings (type 'release', filtered by updatedAt)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayEarningsAgg = await ClinicTransaction.aggregate([
      {
        $match: {
          clinicId: clinic._id,
          visible: { $ne: false },
          type: 'release',
          updatedAt: { $gte: startOfToday, $lte: endOfToday }
        }
      },
      { $group: { _id: null, todayEarnings: { $sum: { $ifNull: ['$amount', 0] } } } }
    ]);
    const todayEarnings = todayEarningsAgg[0]?.todayEarnings || 0;

    // ✅ Final response
    res.json({
      success: true,
      data: {
        clinicId: clinic._id,
        totalEarnings,
        todayEarnings,
        transactions,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / pageLimit),
          totalTransactions: total
        }
      }
    });
  } catch (err) {
    console.error('Get clinic wallet error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};





// ---------------------------------
// Withdraw from clinic in-app wallet (creates a debit transaction and decreases walletBalance)
// Note: For Express accounts, actual payouts are handled by Stripe. This endpoint only adjusts our app-level mirror and can be used to request payouts.
// ---------------------------------
export const withdrawFromWallet = async (req, res) => {
  try {
    const { id } = req.params; // clinic id
    const { amount, currency = 'usd', description } = req.body; // amount in cents

    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Valid amount is required' });

    const clinic = await Clinic.findById(id);
    if (!clinic) return res.status(404).json({ success: false, message: 'Clinic not found' });

    if ((clinic.walletBalance || 0) < amount) return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });

    // Decrease app-level wallet mirror
    clinic.walletBalance = (clinic.walletBalance || 0) - amount;
    await clinic.save();

    // Record a debit transaction
    const txn = new ClinicTransaction({ clinicId: clinic._id, type: 'debit', amount, currency, description });
    await txn.save();

    // Optionally initiate a Stripe transfer to clinic's connected account when configured
    if (process.env.AUTO_PAYOUT_ON_WITHDRAW === 'true' && clinic.stripeAccountId) {
      try {
        const transfer = await stripe.transfers.create({
          amount: amount,
          currency: currency,
          destination: clinic.stripeAccountId,
          metadata: { clinicId: clinic._id.toString(), clinicTransactionId: txn._id.toString() }
        });

        txn.stripeTransferId = transfer.id;
        txn.description = (txn.description || '') + `; transferred to Stripe account ${clinic.stripeAccountId}`;
        await txn.save();
      } catch (e) {
        console.error('Auto payout on withdraw failed', e.message);
      }
    }

    res.json({ success: true, message: 'Withdrawal recorded', data: { clinic, transaction: txn } });
  } catch (err) {
    console.error('Withdraw error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};




//home page data of clinic dashboard

export const homePageDataOfClinic = async (req, res) => {
  try {
    const clinicId = req.clinic.clinicId;

    // Get clinic data
    const clinic = await Clinic.findById(clinicId).select('name image ratingStars ratingsCount walletBalance');
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1️⃣ Today's Appointments for Clinic
    const todaysAppointments = await Appointment.find({
      clinicId,
      status: { $in: ['pending', 'confirmed'] },
      date: { $gte: todayStart, $lte: todayEnd }
    })
      .populate('userId', 'name profileImage')
      .populate('treatmentId', 'name image')
      .sort({ date: 1, time: 1 });

    // 2️⃣ Upcoming Appointments (After Today, Limit 3)
    const upcomingAppointments = await Appointment.find({
      clinicId,
      status: { $in: ['pending', 'confirmed'] },
      date: { $gt: todayEnd }
    })
      .populate('userId', 'name profileImage')
      .populate('treatmentId', 'name image')
      .sort({ date: 1, time: 1 })
      .limit(3);

    // Combine both
    const combinedAppointments = [
      ...todaysAppointments.map(appt => ({ ...appt.toObject(), appointmentType: 'today' })),
      ...upcomingAppointments.map(appt => ({ ...appt.toObject(), appointmentType: 'upcoming' }))
    ];

    // Format appointments for frontend
    const formattedAppointments = combinedAppointments.map(appointment => ({
      id: appointment._id,
      patientName: appointment.userId.name,
      patientImage: appointment.userId.profileImage,
      treatmentName: appointment.treatmentId.name,
      treatmentImage: appointment.treatmentId.image,
      date: appointment.date,
      time: appointment.time,
      status: appointment.status,
      type: appointment.appointmentType
    }));

    // 3️⃣ Active Promotions by Clinic
    const activePromotions = await Promotion.find({
      clinicId,
      isActive: true,
      validTill: { $gte: new Date() }
    })
      .populate('treatmentId', 'name image')
      .sort({ createdAt: -1 })
      .limit(5);

    const formattedPromotions = activePromotions.map(promotion => ({
      id: promotion._id,
      title: promotion.title,
      treatmentName: promotion.treatmentId.name,
      treatmentImage: promotion.treatmentId.image,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      validTill: promotion.validTill,
      image: promotion.image
    }));

    // 4️⃣ Clinic Dashboard Stats
    const totalAppointments = await Appointment.countDocuments({ clinicId });
    const pendingAppointments = await Appointment.countDocuments({ clinicId, status: 'pending' });
    const confirmedAppointments = await Appointment.countDocuments({ clinicId, status: 'confirmed' });

    // 5️⃣ Reminder (Next Appointment in 24h)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextReminders = await Appointment.find({
      clinicId,
      status: 'confirmed',
      date: { $gte: new Date(), $lte: tomorrow }
    })
      .populate('userId', 'name profileImage')
      .populate('treatmentId', 'name image')
      .limit(1);

    let reminder = null;
    if (nextReminders.length > 0) {
      const appointment = nextReminders[0];
      reminder = {
        id: appointment._id,
        patientName: appointment.userId.name,
        treatmentName: appointment.treatmentId.name,
        treatmentImage: appointment.treatmentId.image,
        date: appointment.date,
        time: appointment.time
      };
    }

    // 6️⃣ Response
    res.json({
      success: true,
      data: {
        clinic: {
          name: clinic.name,
          image: clinic.image,
          rating: clinic.ratingStars,
          reviews: clinic.ratingsCount,
          walletBalance: clinic.walletBalance
        },
        stats: {
          totalAppointments,
          pendingAppointments,
          confirmedAppointments
        },
        upcomingAppointments: {
          title: "Your Appointments",
          appointments: formattedAppointments
        },
        promotions: {
          title: "Active Promotions",
          promotions: formattedPromotions
        },
        reminder
      }
    });

  } catch (error) {
    console.error('Clinic Home Page Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};



export const getAppointmentsOfClinicByDate = async (req, res) => {
  try {
    const clinicId = req.clinic.clinicId;
    const { date } = req.params; // example: "2025-10-25T00:00:00.000"
    const { status } = req.query;

    // Parse input date to ensure consistent UTC format
    const inputDate = new Date(date);
    const formattedDate = new Date(Date.UTC(
      inputDate.getUTCFullYear(),
      inputDate.getUTCMonth(),
      inputDate.getUTCDate()
    ));

    const query = {
      clinicId,
      date: formattedDate
    };

    if (status) query.status = status;

    const appointments = await Appointment.find(query)
      .populate('clinicId', 'name address image')
      .populate('treatmentId', 'name price image')
      .sort({ time: 1 });

    res.json({
      success: true,
      data: {
        date,
        totalAppointments: appointments.length,
        appointments
      }
    });

  } catch (error) {
    console.error('Get appointments by date error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get clinic reviews
export const getClinicReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const clinic = await Clinic.findById(id).select('userReviews');
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get reviews with pagination
    const reviews = clinic.userReviews
      .sort((a, b) => {
        const aVal = a[sortBy] || a.createdAt;
        const bVal = b[sortBy] || b.createdAt;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      })
      .slice((page - 1) * limit, page * limit);

    // Populate user details for reviews
    const populatedReviews = await Promise.all(
      reviews.map(async (review) => {
        const user = await User.findById(review.userId).select('name profileImage');
        return {
          ...review.toObject(),
          user
        };
      })
    );

    res.json({
      success: true,
      data: {
        reviews: populatedReviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(clinic.userReviews.length / limit),
          totalReviews: clinic.userReviews.length,
          hasNext: page * limit < clinic.userReviews.length,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get clinic reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get clinics by location (nearby)
export const getClinicsByLocation = async (req, res) => {
  try {
    const { latitude, longitude, radius = 10 } = req.query; // radius in km
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user?.userId; // Get userId if authenticated

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseFloat(radius);

    // Simple distance calculation (for more accurate results, use MongoDB geospatial queries)
    const clinics = await Clinic.find({ isActive: true })
      .populate('treatments', 'name treatmentType price image');

    // Filter clinics by distance
    const nearbyClinics = clinics.filter(clinic => {
      if (!clinic.coordinates.latitude || !clinic.coordinates.longitude) {
        return false;
      }

      const distance = calculateDistance(
        lat, lng,
        clinic.coordinates.latitude,
        clinic.coordinates.longitude
      );

      return distance <= rad;
    });

    // Sort by distance
    nearbyClinics.sort((a, b) => {
      const distanceA = calculateDistance(
        lat, lng,
        a.coordinates.latitude,
        a.coordinates.longitude
      );
      const distanceB = calculateDistance(
        lat, lng,
        b.coordinates.latitude,
        b.coordinates.longitude
      );
      return distanceA - distanceB;
    });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    let paginatedClinics = nearbyClinics.slice(startIndex, endIndex);

    // Add isSaved field if user is authenticated
    if (userId) {
      paginatedClinics = await addIsSavedToClinics(userId, paginatedClinics);
    }

    res.json({
      success: true,
      data: {
        clinics: paginatedClinics,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(nearbyClinics.length / limit),
          totalClinics: nearbyClinics.length,
          hasNext: endIndex < nearbyClinics.length,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get clinics by location error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}
