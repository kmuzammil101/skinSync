import mongoose from 'mongoose';

const proofOfExpertise = new Schema(
    {
        image: { type: String },
        name: { type: String }
    }
)


const clinicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    timings: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    treatments: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Treatment'
    },
    proofOfExpertise: {
        type: [proofOfExpertise],
    },
}, {
    timestamps: true
});

export default mongoose.model('Clinic', clinicSchema);


//things to add after
//client feedbacks