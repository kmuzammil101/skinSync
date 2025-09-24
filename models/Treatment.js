import mongoose from 'mongoose';

const treatmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    clinic: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Clinic',
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
    beforeImage: {
        type: String,
        required: true
    },
    afterImage: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
}, {
    timestamps: true
});

export default mongoose.model('Treatment', treatmentSchema);

//things to add after
//rating
//user reviews
//clinic