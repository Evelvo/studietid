const dotenv = require("dotenv");
const path = require('path');
const User = require('../models/user');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sharp = require('sharp');

dotenv.config();

function formatDate(dateString, hm) {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    if (hm) {
        return `${day}.${month}.${year} ${hours}:${minutes}`;
    } else {
        return `${day}.${month}.${year}`;
    }
}


const storage = multer.memoryStorage({
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed.'));
        }
    }
});

const upload_image = multer({
    storage: storage,
});

async function add_user_ep(req, res, type, name, email, password) {
    let rolling_key = crypto.randomBytes(16).toString('hex');

    password = await bcrypt.hash(password, 10);
    email = email.toLowerCase();

    let pfp_data_var = "none"

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        res.redirect('/account/register?que=already_exists');
    } else {
        const user = new User({
            type,
            email,
            password,
            name,
            rolling_key,
            pfp_data: pfp_data_var
        })
    
        await user.save();

        req.session.isUserLoggedIn = true;
        req.session.userId = user._id;

        res.redirect("/dashboard")
        
    }
}


module.exports = { formatDate, upload_image, add_user_ep };