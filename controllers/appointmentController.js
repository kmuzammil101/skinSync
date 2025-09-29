import Appointment from '../models/Appointment.js';
import Treatment from '../models/Treatment.js';
import Clinic from '../models/Clinic.js';
import User from '../models/User.js';

// Create a new appointment
export const createAppointment = async (req, res) => {
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

    // Check for conflicting appointments
    const appointmentDate = new Date(date);
    const existingAppointment = await Appointment.findOne({
      userId,
      clinicId,
      date: appointmentDate,
      time,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'You already have an appointment at this time'
      });
    }

    const appointment = new Appointment({
      userId,
      clinicId,
      treatmentId,
      date: appointmentDate,
      time,
      status: 'pending'
    });

    await appointment.save();

    // Populate the appointment data
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('clinicId', 'name address image')
      .populate('treatmentId', 'name price image');

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: populatedAppointment
    });

  } catch (error) {
    console.error('Create appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
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
