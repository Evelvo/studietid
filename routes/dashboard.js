const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const router = express.Router();
const crypto = require('crypto');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

dotenv.config();

async function isAuthenticated(req, res, next) {
    if (req.session.isUserLoggedIn) {
        try {
            const user = await User.findById(req.session.userId);
            if (user) {
                return next();
            } else {
                res.redirect('/account/login');
                req.session.isUserLoggedIn = false;
                req.session.userId = "";
                req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
            }
        } catch {
            res.redirect('/account/login');
            req.session.isUserLoggedIn = false;
            req.session.userId = "";
            req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
        }
    } else {
        res.redirect('/account/login');
        req.session.isUserLoggedIn = false;
        req.session.userId = "";
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
    }
}

function findSidebarVersion(userType) {
    if (userType == "elev") {
        return "elev_sidebar";
    } else if (userType == "admin") {
        return "admin_sidebar";
    }
}


router.get('/', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        res.render("dashboard/main_dash.html", {
            windowTitle: "Dashbord - Studietid",
            userType: user.type,
            sidebar: findSidebarVersion(user.type),
            main: "home_dyna"

        })
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