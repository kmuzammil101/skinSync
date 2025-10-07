import Treatment from '../models/Treatment.js';
import Clinic from '../models/Clinic.js';
import { success } from 'zod/v4';
import { addIsSavedToTreatments, addIsSavedToTreatment, checkSavedTreatments } from '../utils/saveUtils.js';

// Create a new treatment
export const createTreatment = async (req, res) => {
  try {
    const {
      name,
      treatmentType,
      subType,
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
      subType,
      clinicId,
      description,
      image,
      beforeImage,
      afterImage,
      price
    });

    await treatment.save();

    // Add treatment to clinic's treatments array
    // clinic.treatments.push(treatment._id);
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
    let {
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      treatmentType = "all"
    } = req.query;

    // ✅ Always make search a safe string
    search = String(search || "").trim();
    if (search === "null" || search === "undefined") {
      search = "";
    }

    const userId = req.user?.userId;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    let treatments = [];

    // ✅ Single pipeline handles both "all" and specific type
    const matchStage = {};
    if (treatmentType !== "all") {
      matchStage.treatmentType = treatmentType;
    }
    if (search !== "") {
      matchStage.name = { $regex: search, $options: "i" };
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: sortOptions },
      {
        $lookup: {
          from: "clinics",
          localField: "clinicId",
          foreignField: "_id",
          as: "clinic"
        }
      },
      { $unwind: "$clinic" },
      {
        $group: {
          _id: { $ifNull: ["$treatmentType", "Uncategorized"] },
          treatments: {
            $push: {
              _id: "$_id",
              name: "$name",
              image: "$image",
              clinicName: "$clinic.name",
              businessHours: "$clinic.businessHours"
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          treatmentType: "$_id",
          // 👉 for "all" keep slice 4, for single type return full list
          treatments:
            treatmentType === "all"
              ? { $slice: ["$treatments", 4] }
              : "$treatments"
        }
      }
    ];

    treatments = await Treatment.aggregate(pipeline);

    // Add isSaved if logged in
    if (userId) {
      for (const group of treatments) {
        const treatmentIds = group.treatments.map(t => t._id);
        const savedMap = await checkSavedTreatments(userId, treatmentIds);

        group.treatments = group.treatments.map(treatment => ({
          ...treatment,
          isSaved: savedMap[treatment._id.toString()] || false
        }));
      }
    }

    res.json({
      success: true,
      data: { treatments }
    });
  } catch (error) {
    console.error("Get treatments error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};


export const getTreatmentType = async (req, res) => {
  try {
    // Get enum values directly from schema
    const enumValues = Treatment.schema.path("treatmentType").enumValues;

    // Format into key-value pairs
    const formattedData = enumValues.map((treatmentType, index) => ({
      key: index,
      treatmentType
    }));

    res.status(200).json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error("Get treatment types error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};



// Get treatment by ID
export const getTreatmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId; // Get userId if authenticated

    const treatment = await Treatment.findById(id)
      .populate('clinicId', 'name address image timings');

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    // Add isSaved field if user is authenticated
    let treatmentWithSaved = treatment;
    if (userId) {
      treatmentWithSaved = await addIsSavedToTreatment(userId, treatment);
    }

    res.json({
      success: true,
      data: treatmentWithSaved
    });

  } catch (error) {
    console.error('Get treatment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getTreatmentSubtype = async (req, res) => {
  try {
    // Directly return enums from schema
    const enumValues = Treatment.schema.path("subType").enumValues;

    // format into key-value pairs
    const formatted = enumValues.map((subType, index) => ({
      key: index,
      subType
    }));

    res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.log("error in getTreatmentSubtype", error);
    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};





// Get treatments by treatment type
export const getTreatmentsByType = async (req, res) => {
  try {
    const { type } = req.params;
    let {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search = '',
      subType
    } = req.query;

    const userId = req.user?.userId;

    // ✅ Normalize search param
    search = String(search || '').trim();
    if (search === 'null' || search === 'undefined') {
      search = '';
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build match conditions
    const matchStage = { treatmentType: type };
    if (subType) {
      matchStage.subType = subType;
    }

    // Base pipeline
    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'clinics',
          localField: 'clinicId',
          foreignField: '_id',
          as: 'clinic'
        }
      },
      { $unwind: '$clinic' }
    ];

    // 👉 Apply search only if non-empty
    if (search !== '') {
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { 'clinic.name': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    // ⭐ Project only required fields
    pipeline.push({
      $project: {
        _id: 1,
        name: 1,
        ratingStars: 1,
        image: 1,
        price: 1,
        clinicName: '$clinic.name'
      }
    });

    // Sorting
    pipeline.push({ $sort: sortOptions });

    // Pagination
    pipeline.push(
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );

    // Execute treatments
    let treatments = await Treatment.aggregate(pipeline);

    // Add isSaved field if user is authenticated
    if (userId) {
      treatments = await addIsSavedToTreatments(userId, treatments);
    }

    // Count total (separate pipeline, same search fix)
    const totalPipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'clinics',
          localField: 'clinicId',
          foreignField: '_id',
          as: 'clinic'
        }
      },
      { $unwind: '$clinic' }
    ];

    if (search !== '') {
      totalPipeline.push({
        $match: {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { 'clinic.name': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    totalPipeline.push({ $count: 'total' });

    const total = await Treatment.aggregate(totalPipeline);
    const totalCount = total.length > 0 ? total[0].total : 0;

    res.json({
      success: true,
      data: {
        treatments,
        treatmentType: type,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalTreatments: totalCount,
          hasNext: page < Math.ceil(totalCount / limit),
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

// Get recommended treatments based on user profile data
export const getRecommendedTreatments = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Import User model
    const User = (await import('../models/User.js')).default;

    // Get user profile
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Extract user skin data
    const userSkinData = {
      skintype: user.skintype || [],
      skinConcerns: user.skinConcerns || [],
      skinCondition: user.skinCondition || [],
      skinGoals: user.skinGoals || [],
      lifestyle: user.lifestyle || [],
      medication: user.medication || ''
    };

    // Recommendation rules (same as your code)
    const recommendationRules = {
      // Skin Type
      'Oily Skin': ['Deep Cleansing', 'Oil Control', 'Pore Minimizing', 'Acne Treatment'],
      'Dry Skin': ['Hydrating', 'Moisturizing', 'Anti-Aging', 'Skin Repair'],
      'Combination Skin': ['Balancing', 'T-Zone Treatment', 'Gentle Cleansing'],
      'Sensitive Skin': ['Gentle Treatment', 'Soothing', 'Anti-Inflammatory', 'Hypoallergenic'],
      'Normal Skin': ['Maintenance', 'Preventive Care', 'General Wellness'],

      // Skin Concerns
      'Acne Or Breakouts': ['Acne Treatment', 'Deep Cleansing', 'Oil Control', 'Anti-Inflammatory'],
      'Fine Lines Or Wrinkles': ['Anti-Aging', 'Collagen Boost', 'Skin Tightening', 'Wrinkle Reduction'],
      'Dark Spots Or Pigmentation': ['Pigmentation Treatment', 'Brightening', 'Skin Lightening'],
      'Redness Or Irritation': ['Gentle Treatment', 'Soothing', 'Anti-Inflammatory', 'Calming'],
      'Dryness Or Dehydration': ['Hydrating', 'Moisturizing', 'Skin Repair', 'Nourishing'],
      'Dullness Or Uneven Tone': ['Brightening', 'Exfoliation', 'Skin Renewal', 'Tone Correcting'],
      'None Of Them': ['Maintenance', 'Preventive Care', 'General Wellness'],

      // Skin Conditions
      'Acne': ['Acne Treatment', 'Deep Cleansing', 'Oil Control', 'Anti-Inflammatory'],
      'Eczema': ['Gentle Treatment', 'Soothing', 'Anti-Inflammatory', 'Skin Repair'],
      'Psoriasis': ['Gentle Treatment', 'Soothing', 'Anti-Inflammatory', 'Skin Repair'],
      'Rosacea': ['Gentle Treatment', 'Soothing', 'Anti-Inflammatory', 'Calming'],
      'None Of The Above': ['General Wellness', 'Maintenance', 'Preventive Care'],

      // Skin Goals
      'Clearer Skin (Reduce Acne Or Breakouts)': ['Deep Cleansing', 'Acne Treatment', 'Oil Control', 'Anti-Inflammatory'],
      'Brighter Skin (Reduce Dullness Or Dark Spots)': ['Brightening', 'Pigmentation Treatment', 'Skin Lightening', 'Exfoliation'],
      'Firmer Skin (Reduce Fine Lines Or Wrinkles)': ['Anti-Aging', 'Collagen Boost', 'Skin Tightening', 'Wrinkle Reduction'],
      'Hydrated Skin (Reduce Dryness Or Flakiness)': ['Hydrating', 'Moisturizing', 'Skin Repair', 'Nourishing'],
      'Even Skin Tone (Reduce Redness Or Pigmentation)': ['Tone Correcting', 'Brightening', 'Pigmentation Treatment', 'Calming'],

      // Lifestyle
      'Do You Spend A lot Of Time Outdoors?': ['Sun Protection', 'Anti-Aging', 'Skin Repair', 'UV Protection'],
      'Do You Currently Follow A Skincare Regimen?': ['Maintenance', 'Enhancement', 'Advanced Treatment'],
      'Do You Eat A Balanced Diet With Plenty Of Water?': ['General Wellness', 'Maintenance', 'Preventive Care'],
      'Do You Get 7–8 Hours Of Sleep Regularly?': ['General Wellness', 'Skin Repair', 'Anti-Aging'],
      'Do You Experience High Levels Of Stress?': ['Stress Relief', 'Soothing', 'Anti-Inflammatory', 'Calming']
    };

    // Collect recommended treatment types
    const recommendedTypes = new Set();

    userSkinData.skintype.forEach(skinType => {
      (recommendationRules[skinType] || []).forEach(type => recommendedTypes.add(type));
    });
    userSkinData.skinConcerns.forEach(concern => {
      (recommendationRules[concern] || []).forEach(type => recommendedTypes.add(type));
    });
    userSkinData.skinCondition.forEach(condition => {
      (recommendationRules[condition] || []).forEach(type => recommendedTypes.add(type));
    });
    userSkinData.skinGoals.forEach(goal => {
      (recommendationRules[goal] || []).forEach(type => recommendedTypes.add(type));
    });
    userSkinData.lifestyle.forEach(lifestyle => {
      (recommendationRules[lifestyle] || []).forEach(type => recommendedTypes.add(type));
    });

    const recommendedTypesArray = Array.from(recommendedTypes);

    let treatments = [];

    if (recommendedTypesArray.length > 0) {
      treatments = await Treatment.aggregate([
        {
          $match: {
            $or: [
              { treatmentType: { $in: recommendedTypesArray } },
              { subType: { $in: recommendedTypesArray } }
            ]
          }
        },
        {
          $lookup: {
            from: 'clinics',
            localField: 'clinicId',
            foreignField: '_id',
            as: 'clinic'
          }
        },
        { $unwind: '$clinic' },
        {
          $project: {
            _id: 1,
            name: 1,
            treatmentType: 1,
            subType: 1,
            description: 1,
            image: 1,
            price: 1,
            ratingStars: 1,
            ratingsCount: 1,
            clinicName: '$clinic.name',
            clinicAddress: '$clinic.address',
            clinicImage: '$clinic.image'
          }
        },
        { $sort: { ratingStars: -1, ratingsCount: -1 } },
        { $skip: skip },   // 👈 pagination
        { $limit: parseInt(limit) }
      ]);
    }

    // If not enough, fill with popular
    if (treatments.length < parseInt(limit)) {
      const remainingLimit = parseInt(limit) - treatments.length;
      const popularTreatments = await Treatment.aggregate([
        {
          $lookup: {
            from: 'clinics',
            localField: 'clinicId',
            foreignField: '_id',
            as: 'clinic'
          }
        },
        { $unwind: '$clinic' },
        {
          $project: {
            _id: 1,
            name: 1,
            treatmentType: 1,
            subType: 1,
            description: 1,
            image: 1,
            price: 1,
            ratingStars: 1,
            ratingsCount: 1,
            clinicName: '$clinic.name',
            clinicAddress: '$clinic.address',
            clinicImage: '$clinic.image'
          }
        },
        { $sort: { ratingStars: -1, ratingsCount: -1 } },
        { $skip: skip },   // 👈 also apply pagination here
        { $limit: remainingLimit }
      ]);

      const existingIds = new Set(treatments.map(t => t._id.toString()));
      const uniquePopularTreatments = popularTreatments.filter(t => !existingIds.has(t._id.toString()));
      treatments = [...treatments, ...uniquePopularTreatments];
    }

    // Add recommendation reason
    const treatmentsWithReasons = treatments.map(treatment => {
      let reason = 'Popular treatment';
      if (recommendedTypesArray.includes(treatment.treatmentType)) {
        reason = `Recommended for your ${treatment.treatmentType.toLowerCase()} needs`;
      } else if (recommendedTypesArray.includes(treatment.subType)) {
        reason = `Recommended for your ${treatment.subType.toLowerCase()} concerns`;
      }
      return { ...treatment, recommendationReason: reason };
    });

    // Add isSaved field
    const treatmentsWithSaved = await addIsSavedToTreatments(userId, treatmentsWithReasons);

    res.json({
      success: true,
      data: {
        treatments: treatmentsWithSaved,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          count: treatmentsWithSaved.length
        },
        userProfile: userSkinData,
        recommendationCriteria: recommendedTypesArray,
        totalRecommendations: treatmentsWithSaved.length
      }
    });

  } catch (error) {
    console.error('Get recommended treatments error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};