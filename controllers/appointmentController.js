import Appointment from '../models/Appointment.js';
import Treatment from '../models/Treatment.js';
import Clinic from '../models/Clinic.js';
import User from '../models/User.js';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' });

// Create a new appointment
export const createAppointmentPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { clinicId, treatmentId, date, time } = req.body;

    // Validate required fields
    if (!clinicId || !treatmentId || !date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Clinic ID, treatment ID, date, and time are required'
      });
    }

    // Check if clinic exists
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }

    // Check if treatment exists
    const treatment = await Treatment.findById(treatmentId);
    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    // Check if treatment belongs to the clinic
    if (treatment.clinicId.toString() !== clinicId) {
      return res.status(400).json({
        success: false,
        message: 'Treatment does not belong to the specified clinic'
      });
    }

    // Calculate amount in cents
    const amount = process.env.PRICE_IN_CENTS === 'true'
      ? treatment.price
      : Math.round((treatment.price || 0) * 100);

    // Create PaymentIntent with metadata (appointment details)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      metadata: {
        userId: userId.toString(),
        clinicId: clinicId.toString(),
        treatmentId: treatmentId.toString(),
        date,
        time
      },
      automatic_payment_methods: { enabled: true }
    });

    // Return client secret for frontend payment
    res.status(201).json({
      success: true,
      message: 'Proceed to payment',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });
  } catch (error) {
    console.error('Create appointment payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};



export const getMonthSlots = async (req, res) => {
  try {
    const { clinicId, year, month } = req.params; // month: 1-12
    const { slots } = req.query; // optional comma separated times e.g. '09:00,10:00'

    // Validate inputs
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!clinicId || isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return res.status(400).json({ success: false, message: 'Invalid clinicId/year/month' });
    }

    // Check clinic exists
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({ success: false, message: 'Clinic not found' });
    }

    // Determine total days in month
    const daysInMonth = new Date(y, m, 0).getDate();

    // Prepare default slot list
    let slotList = [];
    if (slots) {
      slotList = slots.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      for (let h = 9; h <= 17; h++) {
        const hh = h.toString().padStart(2, '0');
        slotList.push(`${hh}:00`);
      }
    }

    // Fetch all appointments for this month
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m - 1, daysInMonth, 23, 59, 59, 999);

    const appts = await Appointment.find({
      clinicId,
      date: { $gte: startDate, $lte: endDate },
      status: { $in: ['pending', 'confirmed'] }
    });

    // Group appointments by local date (YYYY-MM-DD)
    const apptMap = {};
    appts.forEach(a => {
      const d = new Date(a.date);
      const key = d.toLocaleDateString('en-CA'); // ✅ keeps it local (no UTC shift)
      apptMap[key] = apptMap[key] || new Set();
      apptMap[key].add(a.time);
    });

    // Build result array for each day
    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(y, m - 1, day);
      const dateKey = dateObj.toLocaleDateString('en-CA'); // ✅ local-safe
      const bookedSet = apptMap[dateKey] || new Set();

      const slotsForDay = slotList.map(t => ({
        time: t,
        alreadyBooked: bookedSet.has(t)
      }));

      result.push({ date: dateKey, slots: slotsForDay });
    }

    // ✅ Sort by date ascending (1st day → last day)
    result.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Send response
    res.json({
      success: true,
      data: { year: y, month: m, days: daysInMonth, result }
    });

  } catch (err) {
    console.error('Get month slots error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};




// Get all appointments for a user
export const getAppointments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const query = { userId };

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const appointments = await Appointment.find(query)
      .populate('clinicId', 'name address image')
      .populate('treatmentId', 'name price image')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(query);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalAppointments: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get appointment by ID
export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const appointment = await Appointment.findOne({ _id: id, userId })
      .populate('clinicId', 'name address image timings')
      .populate('treatmentId', 'name price image description');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      data: appointment
    });

  } catch (error) {
    console.error('Get appointment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get appointments by date
export const getAppointmentsByDate = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { date } = req.params;
    const { status } = req.query;

    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const query = {
      userId,
      date: {
        $gte: startDate,
        $lt: endDate
      }
    };

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
      .populate('clinicId', 'name address image')
      .populate('treatmentId', 'name price image')
      .sort({ time: 1 });

    res.json({
      success: true,
      data: {
        appointments,
        date: date,
        totalAppointments: appointments.length
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

// Update appointment status
export const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.userId;

    if (!status || !['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (pending, confirmed, cancelled)'
      });
    }

    const appointment = await Appointment.findOneAndUpdate(
      { _id: id, userId },
      { status },
      { new: true, runValidators: true }
    ).populate('clinicId', 'name address image')
      .populate('treatmentId', 'name price image');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      message: 'Appointment status updated successfully',
      data: appointment
    });

  } catch (error) {
    console.error('Update appointment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Cancel appointment
export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const appointment = await Appointment.findOneAndUpdate(
      { _id: id, userId },
      { status: 'cancelled' },
      { new: true, runValidators: true }
    ).populate('clinicId', 'name address image')
      .populate('treatmentId', 'name price image');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment
    });

  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get upcoming appointments
export const getUpcomingAppointments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 5 } = req.query;

    const appointments = await Appointment.find({
      userId,
      status: { $in: ['pending', 'confirmed'] },
      date: { $gte: new Date() }
    })
      .populate('clinicId', 'name address image')
      .populate('treatmentId', 'name price image')
      .sort({ date: 1, time: 1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        appointments,
        totalUpcoming: appointments.length
      }
    });

  } catch (error) {
    console.error('Get upcoming appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
