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
    const {
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      treatmentType = "all"
    } = req.query;

    const userId = req.user?.userId; // Get userId if authenticated

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    let treatments = [];

    if (treatmentType === "all") {
      // 👉 Get 4 treatments per type
      const pipeline = [
        {
          $match: search
            ? { name: { $regex: search, $options: "i" } }
            : {}
        },
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
            _id: "$treatmentType",
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
            treatments: { $slice: ["$treatments", 4] } // only 4 per type
          }
        }
      ];

      treatments = await Treatment.aggregate(pipeline);

      // Add isSaved field to treatments within each group if user is authenticated
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
    } else {
      // 👉 Query when filtering by single type
      const query = { treatmentType };

      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      treatments = await Treatment.find(query)
        .select("name image clinicId") // select only required fields
        .populate("clinicId", "name businessHours") // only name + businessHours from clinic
        .sort(sortOptions);

      // Add isSaved field if user is authenticated
      if (userId) {
        treatments = await addIsSavedToTreatments(userId, treatments);
        }
      }

      res.json({
        success: true,
      data: {
        treatments
      }
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
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      search = '',        
      subType             
    } = req.query;

    const userId = req.user?.userId; // Get userId if authenticated

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build match conditions
    const matchStage = { treatmentType: type };
    if (subType) {
      matchStage.subType = subType;
    }

    // Pipeline
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

    // If search provided
    if (search) {
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
      { $skip: (page - 1) * parseInt(limit) },
      { $limit: parseInt(limit) }
    );

    // Execute treatments
    let treatments = await Treatment.aggregate(pipeline);

    // Add isSaved field if user is authenticated
    if (userId) {
      treatments = await addIsSavedToTreatments(userId, treatments);
    }

    // Count total
    const total = await Treatment.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'clinics',
          localField: 'clinicId',
          foreignField: '_id',
          as: 'clinic'
        }
      },
      { $unwind: '$clinic' },
      ...(search ? [{
        $match: {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { 'clinic.name': { $regex: search, $options: 'i' } }
          ]
        }
      }] : []),
      { $count: 'total' }
    ]);

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
    const { limit = 10 } = req.query;

    // Import User model
    const User = (await import('../models/User.js')).default;

    // Get user profile data
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

    // Define treatment recommendations based on skin data
    const recommendationRules = {
      // Skin Type based recommendations
      'Oily Skin': ['Deep Cleansing', 'Oil Control', 'Pore Minimizing', 'Acne Treatment'],
      'Dry Skin': ['Hydrating', 'Moisturizing', 'Anti-Aging', 'Skin Repair'],
      'Combination Skin': ['Balancing', 'T-Zone Treatment', 'Gentle Cleansing'],
      'Sensitive Skin': ['Gentle Treatment', 'Soothing', 'Anti-Inflammatory', 'Hypoallergenic'],
      'Normal Skin': ['Maintenance', 'Preventive Care', 'General Wellness'],

      // Skin Concerns based recommendations
      'Acne Or Breakouts': ['Acne Treatment', 'Deep Cleansing', 'Oil Control', 'Anti-Inflammatory'],
      'Fine Lines Or Wrinkles': ['Anti-Aging', 'Collagen Boost', 'Skin Tightening', 'Wrinkle Reduction'],
      'Dark Spots Or Pigmentation': ['Pigmentation Treatment', 'Brightening', 'Skin Lightening'],
      'Redness Or Irritation': ['Gentle Treatment', 'Soothing', 'Anti-Inflammatory', 'Calming'],
      'Dryness Or Dehydration': ['Hydrating', 'Moisturizing', 'Skin Repair', 'Nourishing'],
      'Dullness Or Uneven Tone': ['Brightening', 'Exfoliation', 'Skin Renewal', 'Tone Correcting'],
      'None Of Them': ['Maintenance', 'Preventive Care', 'General Wellness'],

      // Skin Conditions based recommendations
      'Acne': ['Acne Treatment', 'Deep Cleansing', 'Oil Control', 'Anti-Inflammatory'],
      'Eczema': ['Gentle Treatment', 'Soothing', 'Anti-Inflammatory', 'Skin Repair'],
      'Psoriasis': ['Gentle Treatment', 'Soothing', 'Anti-Inflammatory', 'Skin Repair'],
      'Rosacea': ['Gentle Treatment', 'Soothing', 'Anti-Inflammatory', 'Calming'],
      'None Of The Above': ['General Wellness', 'Maintenance', 'Preventive Care'],

      // Skin Goals based recommendations
      'Clearer Skin (Reduce Acne Or Breakouts)': ['Deep Cleansing', 'Acne Treatment', 'Oil Control', 'Anti-Inflammatory'],
      'Brighter Skin (Reduce Dullness Or Dark Spots)': ['Brightening', 'Pigmentation Treatment', 'Skin Lightening', 'Exfoliation'],
      'Firmer Skin (Reduce Fine Lines Or Wrinkles)': ['Anti-Aging', 'Collagen Boost', 'Skin Tightening', 'Wrinkle Reduction'],
      'Hydrated Skin (Reduce Dryness Or Flakiness)': ['Hydrating', 'Moisturizing', 'Skin Repair', 'Nourishing'],
      'Even Skin Tone (Reduce Redness Or Pigmentation)': ['Tone Correcting', 'Brightening', 'Pigmentation Treatment', 'Calming'],

      // Lifestyle based recommendations
      'Do You Spend A lot Of Time Outdoors?': ['Sun Protection', 'Anti-Aging', 'Skin Repair', 'UV Protection'],
      'Do You Currently Follow A Skincare Regimen?': ['Maintenance', 'Enhancement', 'Advanced Treatment'],
      'Do You Eat A Balanced Diet With Plenty Of Water?': ['General Wellness', 'Maintenance', 'Preventive Care'],
      'Do You Get 7–8 Hours Of Sleep Regularly?': ['General Wellness', 'Skin Repair', 'Anti-Aging'],
      'Do You Experience High Levels Of Stress?': ['Stress Relief', 'Soothing', 'Anti-Inflammatory', 'Calming']
    };

    // Collect recommended treatment types
    const recommendedTypes = new Set();

    // Add recommendations based on skin type
    userSkinData.skintype.forEach(skinType => {
      const types = recommendationRules[skinType] || [];
      types.forEach(type => recommendedTypes.add(type));
    });

    // Add recommendations based on skin concerns
    userSkinData.skinConcerns.forEach(concern => {
      const types = recommendationRules[concern] || [];
      types.forEach(type => recommendedTypes.add(type));
    });

    // Add recommendations based on skin conditions
    userSkinData.skinCondition.forEach(condition => {
      const types = recommendationRules[condition] || [];
      types.forEach(type => recommendedTypes.add(type));
    });

    // Add recommendations based on skin goals
    userSkinData.skinGoals.forEach(goal => {
      const types = recommendationRules[goal] || [];
      types.forEach(type => recommendedTypes.add(type));
    });

    // Add recommendations based on lifestyle factors
    userSkinData.lifestyle.forEach(lifestyle => {
      const types = recommendationRules[lifestyle] || [];
      types.forEach(type => recommendedTypes.add(type));
    });

    // Convert Set to Array
    const recommendedTypesArray = Array.from(recommendedTypes);

    // If no specific recommendations, get popular treatments
    let treatments = [];
    
    if (recommendedTypesArray.length > 0) {
      // Get treatments that match recommended types
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
        { $limit: parseInt(limit) }
      ]);
    }

    // If we don't have enough recommendations, fill with popular treatments
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
        { $limit: remainingLimit }
      ]);

      // Combine recommended and popular treatments, avoiding duplicates
      const existingIds = new Set(treatments.map(t => t._id.toString()));
      const uniquePopularTreatments = popularTreatments.filter(t => !existingIds.has(t._id.toString()));
      treatments = [...treatments, ...uniquePopularTreatments];
    }

    // Add recommendation reason and isSaved field for each treatment
    const treatmentsWithReasons = treatments.map(treatment => {
      let reason = 'Popular treatment';
      
      if (recommendedTypesArray.includes(treatment.treatmentType)) {
        reason = `Recommended for your ${treatment.treatmentType.toLowerCase()} needs`;
      } else if (recommendedTypesArray.includes(treatment.subType)) {
        reason = `Recommended for your ${treatment.subType.toLowerCase()} concerns`;
      }

      return {
        ...treatment,
        recommendationReason: reason
      };
    });

    // Add isSaved field to all treatments
    const treatmentsWithSaved = await addIsSavedToTreatments(userId, treatmentsWithReasons);

    res.json({
      success: true,
      data: {
        treatments: treatmentsWithSaved,
        userProfile: {
          skintype: userSkinData.skintype,
          skinConcerns: userSkinData.skinConcerns,
          skinCondition: userSkinData.skinCondition,
          skinGoals: userSkinData.skinGoals,
          lifestyle: userSkinData.lifestyle,
          medication: userSkinData.medication
        },
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