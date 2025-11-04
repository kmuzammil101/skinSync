import Appointment from '../models/Appointment.js';
import Treatment from '../models/Treatment.js';
import Clinic from '../models/Clinic.js';
import User from '../models/User.js';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { sendNotificationToDeviceAndSave } from "../utils/fcmService.js"
import { sendNotificationToClinicAndSave } from "../utils/fcmForClinic.js"
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

    // Validate date/time formats (basic checks)
    const apptDate = new Date(date);
    if (isNaN(apptDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format' });
    }
    // Prevent booking before today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (apptDate < today) {
      return res.status(400).json({ success: false, message: 'Cannot book appointments in the past' });
    }
    // Expect time like '09:00' or '14:30'
    // Accept time in 'HH:MM', 'HH:MM AM', or 'HH:MM PM' format
    if (!/^(\d{2}:\d{2})(\s?(AM|PM))?$/i.test(time)) {
      return res.status(400).json({ success: false, message: 'Invalid time format (expected HH:MM or HH:MM AM/PM)' });
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

    // Normalize date to local date only (strip time component) for conflict checks
    const startOfDay = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate());
    const endOfDay = new Date(apptDate.getFullYear(), apptDate.getMonth(), apptDate.getDate(), 23, 59, 59, 999);

    // Conflict checks
    // 1) Check if the clinic already has an appointment at this date/time (pending/confirmed)
    const existingClinicAppt = await Appointment.findOne({
      clinicId,
      date: { $gte: startOfDay, $lte: endOfDay },
      time,
      status: { $in: ['pending', 'confirmed'] }
    });
    if (existingClinicAppt) {
      return res.status(409).json({ success: false, message: 'Selected time slot is already booked at this clinic' });
    }

    // 2) Prevent user from double-booking same date/time (same or different clinic)
    const existingUserAppt = await Appointment.findOne({
      userId,
      date: { $gte: startOfDay, $lte: endOfDay },
      time,
      status: { $in: ['pending', 'confirmed'] }
    });
    if (existingUserAppt) {
      return res.status(409).json({ success: false, message: 'You already have an appointment at this time' });
    }

    // Calculate amount in cents, apply treatment discount if present
    // Support discount stored as `discountPercentage` or `discount` on the treatment document
    const rawPrice = treatment.price || 0; // could be dollars or cents depending on PRICE_IN_CENTS
    const discountPercentage = typeof treatment.discountPercentage === 'number'
      ? treatment.discountPercentage
      : (typeof treatment.discount === 'number' ? treatment.discount : 0);

    let amount;
    if (process.env.PRICE_IN_CENTS === 'true') {
      // price already in cents
      const baseCents = Number(rawPrice) || 0;
      if (discountPercentage > 0 && discountPercentage < 100) {
        amount = Math.round(baseCents * (1 - discountPercentage / 100));
      } else {
        amount = baseCents;
      }
    } else {
      // price stored in main currency units (dollars)
      const baseDollars = Number(rawPrice) || 0;
      const finalDollars = (discountPercentage > 0 && discountPercentage < 100)
        ? baseDollars * (1 - discountPercentage / 100)
        : baseDollars;
      amount = Math.round(finalDollars * 100);
    }

    // Create PaymentIntent with metadata (appointment details)
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        metadata: {
          userId: userId.toString(),
          clinicId: clinicId.toString(),
          treatmentId: treatmentId.toString(),
          date,
          time,
          discountPercentage: discountPercentage || 0
        },
        automatic_payment_methods: { enabled: true }
      });
    } catch (stripeErr) {
      console.error('Stripe error creating PaymentIntent:', stripeErr);
      // Map common Stripe errors to appropriate HTTP statuses
      if (stripeErr.type === 'StripeInvalidRequestError') {
        return res.status(400).json({ success: false, message: stripeErr.message });
      }
      return res.status(502).json({ success: false, message: 'Payment provider error' });
    }

    // Return client secret for frontend payment
    return res.status(201).json({
      success: true,
      message: 'Proceed to payment',
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });
  } catch (error) {
    console.error('Create appointment payment error:', error);
    // If it's a known Mongoose validation or cast error
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

//reschedule appoitment
export const rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId, date, time } = req.body;
    const userId = req.user.userId;

    // ✅ Validate input
    if (!appointmentId || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "appointmentId, date, and time are required",
      });
    }

    // ✅ Fetch existing appointment
    const existingAppointment = await Appointment.findById(appointmentId);
    if (!existingAppointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // ✅ Check ownership
    if (existingAppointment.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to reschedule this appointment",
      });
    }

    // ✅ Cancel old appointment
    existingAppointment.status = "reschedule_on_another_day";

    // ✅ Create new appointment with updated date/time
    const newAppointment = new Appointment({
      ...existingAppointment.toObject(), // copy all fields
      _id: undefined,                   // remove old id
      date,
      time,
      status: "confirmed",
    });

    // ✅ Save both concurrently
    await Promise.all([existingAppointment.save(), newAppointment.save()]);

    const formattedDate = new Date(date).toLocaleDateString();
    const userNotification = {
      clinicId: existingAppointment.clinicId,
      title: "Appointment Rescheduled",
      message: `Your appointment has been rescheduled to ${time} on ${formattedDate}.`,
      type: "appointment_reschedule",
      metadata: {
        appointmentId: newAppointment._id.toString(),
        oldAppointmentId: existingAppointment._id.toString(),
        date,
        time,
      },
    };

    const clinicNotification = {
      userId: existingAppointment.userId,
      title: "Appointment Rescheduled",
      message: `A patient rescheduled their appointment to ${time} on ${formattedDate}.`,
      type: "appointment_reschedule",
      metadata: {
        appointmentId: newAppointment._id.toString(),
        userId: existingAppointment.userId.toString(),
        date,
        time,
      },
    };

    // ✅ Send notifications concurrently
    await Promise.all([
      sendNotificationToDeviceAndSave(existingAppointment.userId, userNotification),
      sendNotificationToClinicAndSave(existingAppointment.clinicId, clinicNotification),
    ]);

    // ✅ Return response
    res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      oldAppointment: existingAppointment,
      newAppointment,
    });

  } catch (error) {
    console.error("Error rescheduling appointment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



export const getMonthSlots = async (req, res) => {
  try {
    const { clinicId, year, month } = req.params;

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!clinicId || isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return res.status(400).json({ success: false, message: 'Invalid clinicId/year/month' });
    }

    const clinic = await Clinic.findById(clinicId);
    if (!clinic) {
      return res.status(404).json({ success: false, message: 'Clinic not found' });
    }

    const daysInMonth = new Date(y, m, 0).getDate();

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m - 1, daysInMonth, 23, 59, 59, 999);

    const appts = await Appointment.find({
      clinicId,
      date: { $gte: startDate, $lte: endDate },
      status: { $in: ['pending', 'confirmed', 'paid', 'ongoing'] }
    });

    const bookedMap = {};
    appts.forEach(a => {
      const d = new Date(a.date);
      const key = d.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!bookedMap[key]) bookedMap[key] = new Set();
      bookedMap[key].add(a.time);
    });

    // ✅ Case-insensitive day matching for businessHours
    const getHoursForDay = (weekday) => {
      if (!clinic.businessHours || clinic.businessHours.length === 0) return null;
      const weekdayLower = weekday.toLowerCase();
      for (const hours of clinic.businessHours) {
        if (
          hours.daysOfWeek &&
          hours.daysOfWeek.some(d => d.toLowerCase() === weekdayLower)
        ) {
          return hours.timeRange;
        }
      }
      return null; // closed if no entry found
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(y, m - 1, day);
      if (dateObj < today) continue;

      const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
      const timeRange = getHoursForDay(weekday);

      if (!timeRange || !timeRange.start || !timeRange.end) continue;

      const [startH, startM] = timeRange.start.split(':').map(Number);
      const [endH, endM] = timeRange.end.split(':').map(Number);

      const slotsForDay = [];
      const dateKey = dateObj.toISOString().split('T')[0];

      // Generate 1-hour slots
      for (let h = startH; h < endH; h++) {
        const time = `${String(h).padStart(2, '0')}:00`;
        const isBooked = bookedMap[dateKey]?.has(time) || false;
        slotsForDay.push({
          time,
          available: !isBooked
        });
      }

      result.push({
        date: dateKey,
        day: weekday,
        slots: slotsForDay
      });
    }

    res.json({
      success: true,
      data: {
        year: y,
        month: m,
        totalDays: result.length,
        result
      }
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
      userId,
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

    console.log('Fetching appointments for user:', userId);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0); // Today 00:00:00

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999); // Today 23:59:59

    // 1️⃣ Today's appointments
    const todaysAppointments = await Appointment.find({
      userId,
      status: { $in: ['pending', 'confirmed'] },
      date: { $gte: todayStart, $lte: todayEnd },
    })
      .populate('clinicId', 'name address image')
      .populate('treatmentId', 'name price image')
      .sort({ date: 1, time: 1 });

    // 2️⃣ Upcoming appointments (after today)
    const upcomingAppointments = await Appointment.find({
      userId,
      status: { $in: ['pending', 'confirmed'] },
      date: { $gt: todayEnd },
    })
      .populate('clinicId', 'name address image')
      .populate('treatmentId', 'name price image')
      .sort({ date: 1, time: 1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        todaysAppointments,
        upcomingAppointments,
        totalToday: todaysAppointments.length,
        totalUpcoming: upcomingAppointments.length,
      },
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};


//trackAppointmentProgressController


export const getAppointmentsByStatusController = async (req, res) => {
  try {
    const userId = req.user.userId;
    console.log(userId)
    const { status } = req.query;

    // Validate status
    if (!["ongoing", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'ongoing' or 'completed'"
      });
    }

    // Fetch appointments by status
    const appointments = await Appointment.find({
      userId,
      status
    })
      .populate("clinicId", "name address")
      .populate("treatmentId", "name price image")
      .sort({ createdAt: -1 });

    // Format response
    const formattedAppointments = appointments.map(app => ({
      appointmentId: app._id,
      treatmentName: app.treatmentId?.name || "Unknown",
      clinicName: app.clinicId?.name || "Unknown",
      date: app.date,
      time: app.time,
      status: app.status,
      completionPercentage: status === "ongoing" ? app.completionPercentage : 100,
      amount: app.amount,
      paymentStatus: app.paymentStatus,
      image: app.treatmentId?.image
    }));

    res.status(200).json({
      success: true,
      count: formattedAppointments.length,
      data: formattedAppointments
    });

  } catch (error) {
    console.error("Get Appointments By Status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
