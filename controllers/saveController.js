import Save from "../models/Save.js"


export const toggleSave = async (req, res) => {
  try {
    const { id, type, isSaved } = req.body;
    const userId = req.user.userId;

    if (!["treatment", "clinic"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }

    let updateQuery = {};

    if (type === "treatment") {
      updateQuery = isSaved
        ? { $addToSet: { savedTreatments: id } }
        : { $pull: { savedTreatments: id } };
    } else if (type === "clinic") {
      updateQuery = isSaved
        ? { $addToSet: { savedClinics: id } }
        : { $pull: { savedClinics: id } };
    }

    const saved = await Save.findOneAndUpdate(
      { userId },
      updateQuery,
      { upsert: true, new: true }
    );

    // ✅ check if item is actually saved
    let isCurrentlySaved = false;
    if (type === "treatment") {
      isCurrentlySaved = saved.savedTreatments?.some(t => t.toString() === id);
    } else if (type === "clinic") {
      isCurrentlySaved = saved.savedClinics?.some(c => c.toString() === id);
    }

    res.status(200).json({
      success: true,
      message: `${type} ${isSaved ? "saved" : "removed from saved"}`,
      data: {
        isSaved: isCurrentlySaved, // 👈 status flag for frontend
        saved
      }
    });
  } catch (error) {
    console.error("Toggle save error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};



export const getSavedItems = async (req, res) => {
  try {
    const userId = req.user.userId;

    const saved = await Save.findOne({ userId })
      .populate("savedTreatments", "name image price")
      .populate("savedClinics", "name image address businessHours");

    res.status(200).json({
      success: true,
      data: saved || { savedTreatments: [], savedClinics: [] }
    });
  } catch (error) {
    console.error("Get saved items error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};