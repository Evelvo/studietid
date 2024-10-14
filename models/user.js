const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    type: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    rolling_key: { type: String },
    pfp_data: { type: String },
});

const User = mongoose.model('User', UserSchema);

module.exports = User;
