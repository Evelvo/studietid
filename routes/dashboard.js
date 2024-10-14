const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const router = express.Router();
const crypto = require('crypto');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

dotenv.config();

function isAuthenticated(req, res, next) {
    if (req.session.isUserLoggedIn) {
        return next();
    } else {
        res.redirect('/account/login');
    }
}

router.get('/', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        return res.render('alert_page.html', { 
            title: "Dashboard", 
            msg: user.type, 
            comefrom: "/account/login" 
        });
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/account/create_password" 
        });
    }
});


module.exports = router;