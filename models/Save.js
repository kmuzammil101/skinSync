import mongoose from "mongoose";

const saveSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    // allow saving both treatments and clinics
    savedTreatments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Treatment"
      }
    ],
    savedClinics: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Clinic"
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("Save", saveSchema);
