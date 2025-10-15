import Clinic from '../models/Clinic.js';
import Treatment from '../models/Treatment.js';
import User from '../models/User.js';
import { addIsSavedToClinics, addIsSavedToClinic } from '../utils/saveUtils.js';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import ClinicTransaction from '../models/ClinicTransaction.js';

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


// Create clinic
export const createClinic = async (req, res) => {
  try {
    const {
      name,
      description,
      image,
      address,
      phone,
      email,
      website,
      businessHours,
      coordinates,
      proofOfExpertise,
      slowDays
    } = req.body;
    console.log(req.body)
    // Validate required fields
    if (!name || !description || !image || !address || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, image, address, phone, and email are required'
      });
    }

    const clinic = new Clinic({
      name,
      description,
      image,
      address,
      phone,
      email,
      website,
      businessHours,
      coordinates,
      proofOfExpertise,
      slowDays
    });

    await clinic.save();

    res.status(201).json({
      success: true,
      message: 'Clinic created successfully',
      data: clinic
    });

  } catch (error) {
    console.error('Create clinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
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

// ---------------------------------
// Get clinic wallet (balance + transactions)
// ---------------------------------
export const getClinicWallet = async (req, res) => {
  try {
    const { id } = req.params; // clinic id
    const clinic = await Clinic.findById(id);
    if (!clinic) return res.status(404).json({ success: false, message: 'Clinic not found' });

    // fetch transactions from our mirror collection
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const transactions = await ClinicTransaction.find({ clinicId: clinic._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ClinicTransaction.countDocuments({ clinicId: clinic._id });

    // Optionally, fetch stripe balance for connected account to display real balance (if clinic has connected account)
    let stripeBalance = null;
    if (clinic.stripeAccountId) {
      try {
        stripeBalance = await stripe.balance.retrieve({}, { stripeAccount: clinic.stripeAccountId });
      } catch (e) {
        console.warn('Could not retrieve stripe balance for clinic', e.message);
      }
    }

    res.json({
      success: true,
      data: {
        clinicId: clinic._id,
        walletBalance: clinic.walletBalance || 0,
        stripeBalance,
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalTransactions: total
        }
      }
    });
  } catch (err) {
    console.error('Get clinic wallet error', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

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
    if (process.env.AUTO_TRANSFER_ON_RELEASE === 'true' && clinic.stripeAccountId) {
      try {
        // Create a transfer from platform to connected account
        const transfer = await stripe.transfers.create({
          amount: releaseAmount,
          currency: 'usd',
          destination: clinic.stripeAccountId,
          metadata: { clinicId: clinic._id.toString(), clinicTransactionId: txn._id.toString() }
        });

        // Record transfer id on transaction and also mark as credit -> then debit from wallet mirror
        txn.stripeTransferId = transfer.id;
        txn.type = 'credit';
        txn.description += `; transferred to Stripe account ${clinic.stripeAccountId}`;
        await txn.save();

        // Decrease walletBalance because money moved out to Stripe (mirror)
        clinic.walletBalance = (clinic.walletBalance || 0) - releaseAmount;
        await clinic.save();
      } catch (e) {
        console.error('Auto transfer on release failed', e.message);
      }
    }

    res.json({ success: true, message: 'Released held funds', data: { clinic, transaction: txn } });
  } catch (err) {
    console.error('Release held error', err);
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
