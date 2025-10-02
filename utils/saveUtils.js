import Save from '../models/Save.js';

// Check if treatments are saved by user
export const checkSavedTreatments = async (userId, treatmentIds) => {
  try {
    if (!userId || !treatmentIds || treatmentIds.length === 0) {
      return {};
    }

    const savedData = await Save.findOne({ userId });
    if (!savedData) {
      return {};
    }

    const savedTreatmentIds = savedData.savedTreatments.map(id => id.toString());
    const savedMap = {};

    treatmentIds.forEach(treatmentId => {
      savedMap[treatmentId.toString()] = savedTreatmentIds.includes(treatmentId.toString());
    });

    return savedMap;
  } catch (error) {
    console.error('Error checking saved treatments:', error);
    return {};
  }
};

// Check if clinics are saved by user
export const checkSavedClinics = async (userId, clinicIds) => {
  try {
    if (!userId || !clinicIds || clinicIds.length === 0) {
      return {};
    }

    const savedData = await Save.findOne({ userId });
    if (!savedData) {
      return {};
    }

    const savedClinicIds = savedData.savedClinics.map(id => id.toString());
    const savedMap = {};

    clinicIds.forEach(clinicId => {
      savedMap[clinicId.toString()] = savedClinicIds.includes(clinicId.toString());
    });

    return savedMap;
  } catch (error) {
    console.error('Error checking saved clinics:', error);
    return {};
  }
};

// Add isSaved field to treatments array
export const addIsSavedToTreatments = async (userId, treatments) => {
  try {
    if (!userId || !treatments || treatments.length === 0) {
      return treatments;
    }

    const treatmentIds = treatments.map(treatment => treatment._id);
    const savedMap = await checkSavedTreatments(userId, treatmentIds);

    return treatments.map(treatment => ({
      ...treatment.toObject ? treatment.toObject() : treatment,
      isSaved: savedMap[treatment._id.toString()] || false
    }));
  } catch (error) {
    console.error('Error adding isSaved to treatments:', error);
    return treatments;
  }
};

// Add isSaved field to clinics array
export const addIsSavedToClinics = async (userId, clinics) => {
  try {
    if (!userId || !clinics || clinics.length === 0) {
      return clinics;
    }

    const clinicIds = clinics.map(clinic => clinic._id);
    const savedMap = await checkSavedClinics(userId, clinicIds);

    return clinics.map(clinic => ({
      ...clinic.toObject ? clinic.toObject() : clinic,
      isSaved: savedMap[clinic._id.toString()] || false
    }));
  } catch (error) {
    console.error('Error adding isSaved to clinics:', error);
    return clinics;
  }
};

// Add isSaved field to single treatment
export const addIsSavedToTreatment = async (userId, treatment) => {
  try {
    if (!userId || !treatment) {
      return treatment;
    }

    const savedMap = await checkSavedTreatments(userId, [treatment._id]);
    
    return {
      ...treatment.toObject ? treatment.toObject() : treatment,
      isSaved: savedMap[treatment._id.toString()] || false
    };
  } catch (error) {
    console.error('Error adding isSaved to treatment:', error);
    return treatment;
  }
};

// Add isSaved field to single clinic
export const addIsSavedToClinic = async (userId, clinic) => {
  try {
    if (!userId || !clinic) {
      return clinic;
    }

    const savedMap = await checkSavedClinics(userId, [clinic._id]);
    
    return {
      ...clinic.toObject ? clinic.toObject() : clinic,
      isSaved: savedMap[clinic._id.toString()] || false
    };
  } catch (error) {
    console.error('Error adding isSaved to clinic:', error);
    return clinic;
  }
};

export default {
  checkSavedTreatments,
  checkSavedClinics,
  addIsSavedToTreatments,
  addIsSavedToClinics,
  addIsSavedToTreatment,
  addIsSavedToClinic
};
