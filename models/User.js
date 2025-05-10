const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    connectionId: {
        type: String,
        required: true,
    },
    user_id: {
        type: String,
        required: true,
    },
    meeting_id: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now, // Automatically records the time of creation
    },
});

// Create and export the User model
module.exports = mongoose.model('User', userSchema);
