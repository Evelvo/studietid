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

async function add_user(res, type, name, email, password, imageData) {

    let rolling_key = crypto.randomBytes(16).toString('hex');

    password = await bcrypt.hash(password, 10);
    email = email.toLowerCase();

    let resize_image = imageData;

    let pfp_data_var = "none"


    if (resize_image) {
        console.log(imageData.length);

        resize_image = await sharp(resize_image)
            .jpeg({ quality: 95 })
            .toBuffer();
        
            resize_image = await sharp(resize_image)
            .resize({ fit: 'inside', width: 500, height: 500 })
            .toBuffer();
        
        console.log(resize_image.length);

        pfp_data_var = resize_image.toString('base64')

    } 

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.render('alert_page.html', { 
            title: "Already exists!", 
            msg: "User already exists.", 
            comefrom: "/admin/users" 
        });
    } else {
        const user = new User({
            type,
            email,
            password,
            name,
            rolling_key,
            pfp_data: pfp_data_var,
        })
    
        await user.save();

        return res.render('alert_page.html', { 
            title: "User created!", 
            msg: "User have been created.", 
            comefrom: "/admin/users" 
        });
        
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


module.exports = { add_user, formatDate, upload_image };