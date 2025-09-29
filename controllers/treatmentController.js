import Treatment from '../models/Treatment.js';
import Clinic from '../models/Clinic.js';

// Create a new treatment
export const createTreatment = async (req, res) => {
  try {
    const {
      name,
      treatmentType,
      clinicId,
      description,
      image,
      beforeImage,
      afterImage,
      price
    } = req.body;

    // Validate required fields
    if (!name || !treatmentType || !clinicId || !description || !price) {
      return res.status(400).json({
        success: false,
        message: 'Name, treatment type, clinic ID, description, and price are required'
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

    const treatment = new Treatment({
      name,
      treatmentType,
      clinicId,
      description,
      image,
      beforeImage,
      afterImage,
      price
    });

    await treatment.save();

    // Add treatment to clinic's treatments array
    clinic.treatments.push(treatment._id);
    await clinic.save();

    res.status(201).json({
      success: true,
      message: 'Treatment created successfully',
      data: treatment
    });

  } catch (error) {
    console.error('Create treatment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get all treatments
export const getTreatments = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const query = {};
    
    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { treatmentType: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const treatments = await Treatment.find(query)
      .populate('clinicId', 'name address image')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Treatment.countDocuments(query);

    res.json({
      success: true,
      data: {
        treatments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalTreatments: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get treatments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get treatment by ID
export const getTreatmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const treatment = await Treatment.findById(id)
      .populate('clinicId', 'name address image timings');

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    res.json({
      success: true,
      data: treatment
    });

  } catch (error) {
    console.error('Get treatment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Get treatments by treatment type
export const getTreatmentsByType = async (req, res) => {
  try {
    const { type } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const treatments = await Treatment.find({ treatmentType: type })
      .populate('clinicId', 'name address image')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Treatment.countDocuments({ treatmentType: type });

    res.json({
      success: true,
      data: {
        treatments,
        treatmentType: type,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalTreatments: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get treatments by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update treatment
export const updateTreatment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const treatment = await Treatment.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('clinicId', 'name address image');

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    res.json({
      success: true,
      message: 'Treatment updated successfully',
      data: treatment
    });

  } catch (error) {
    console.error('Update treatment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Delete treatment
export const deleteTreatment = async (req, res) => {
  try {
    const { id } = req.params;

    const treatment = await Treatment.findByIdAndDelete(id);

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    // Remove treatment from clinic's treatments array
    await Clinic.findByIdAndUpdate(
      treatment.clinicId,
      { $pull: { treatments: treatment._id } }
    );

    res.json({
      success: true,
      message: 'Treatment deleted successfully'
    });

  } catch (error) {
    console.error('Delete treatment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
