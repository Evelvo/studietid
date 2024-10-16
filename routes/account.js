const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const router = express.Router();
const crypto = require('crypto');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const Email = require("../controllers/email");
const Global_func = require("../controllers/global_functions");

dotenv.config();


const HOST = process.env.HOST;


router.get('/login',async (req, res) => {
    try {
        const { que } = req.query;
        let wrong_login = false

        if (que == "wrong_login") {
            wrong_login = true
        }
        res.render('account/login.html', {wrong_login});
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/" 
        });
    }
});

router.get('/register',async (req, res) => {
    try {
        res.render('account/register.html');
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/" 
        });
    }
});

router.post('/register',  async (req, res) => {
    try {
        let {name, email, password } = req.body; 
        let type = "elev"
        Global_func.add_user_ep(res, type, name, email, password);
    } catch (error) {
        Global_func.error_handle_outreach(res, error, "/dashboard");
    }
});


router.post('/login', async (req, res) => {
    let { email, password, remember_me } = req.body;
    email = email.toLowerCase();
    try {
        const user = await User.findOne({ email });
        if (user) {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (passwordMatch) {
                req.session.isUserLoggedIn = true;
                req.session.userId = user._id;

                if (user.firstLogin) {
                    res.redirect('/account/create_password');
                } else {
                    if (remember_me) {
                        console.log("fisk")
                        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
                    }
                    let rolling_key = crypto.randomBytes(16).toString('hex');

                    user.rolling_key = rolling_key;

                    await user.save();
                    res.redirect('/dashboard');
                }
            } else {
                res.redirect('/account/login?que=wrong_login');
            }
        } else {
            res.redirect('/account/login?que=wrong_login');
        }
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/account/create_password" 
        });
    }
});


router.get('/forgot_password', async (req, res) => {
    try {
        const { que } = req.query;
        let email_not_exist = false

        if (que == "email_not_exist") {
            email_not_exist = true
        }
        res.render('account/forgot_password.html', {email_not_exist});
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/" 
        });
    }
});

router.post('/forgot_password_send_email', async (req, res) => {
    let { email } = req.body;
    email = email.toLowerCase();
    try {
        let user = await User.findOne({ email });
        if (user) {
            if (user.active) {
                try {
                    console.log(email);
                    let rolling_key = crypto.randomBytes(16).toString('hex');

                    user.rolling_key = rolling_key;


                    await user.save();

                    const receiver = user.email;
                    const subject = 'Glemt passord!';
                    const templateName = 'title_description_button';
                    const context = {
                        title: "Glemt passord",
                        description: "Trykk på 'Endre passord', og et vindu åpnes hvor du kan oppdatere passordet. Dersom dette ikke er deg trenger du ikke å få panikk, men det betyr at noen prøver å logge inn med e-posten din.",
                        button_link: HOST+"/account/forgot_password_new?secret_key="+rolling_key,
                        button_text: "Endre passord"
                    };

                    Email.send_email(receiver, subject, templateName, context);

                    return res.render('alert_page.html', { 
                        title: "E-posten er sendt!", 
                        msg: "Finn endre passord knappen/linken i innboksen.", 
                        comefrom: "/account/forgot_password" 
                    });
                } catch(error) {
                    console.log(error);
                    return res.render('alert_page.html', { 
                        title: "Klarte ikke å sende eposten!", 
                        msg: "Prøv igjen seinere...", 
                        comefrom: "/account/forgot_password" 
                    });
                }
                
            } else {
                res.redirect('/account/user_deactivated');
            }
        } else {
            res.redirect('/account/forgot_password?que=email_not_exist');
        }
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/account/forgot_password" 
        });
    }
});

router.get('/forgot_password_new', async (req, res) => {
    try {
        const { secret_key } = req.query;
        
        let user = await User.findOne({ rolling_key: secret_key });

        if (user) {
            res.render('account/forgot_password_new.html', {secret_key});
        } else {
            res.redirect('/account/login');
        }
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/" 
        });
    }
});

router.post('/forgot_password_new', async (req, res) => {
    let { password, password_repeat } = req.body;
    const { secret_key } = req.query;

    const passwordErrors = [];
    if (password.length < 8) {
        passwordErrors.push("Passordet må være minst 8 tegn.");
    }
    if (!/\d/.test(password)) {
        passwordErrors.push("Passordet må inneholde 1 tall.");
    }
    if (password !== password_repeat) {
        passwordErrors.push("De to passord feltene er ikke like.");
    }

    if (passwordErrors.length > 0) {
        return res.render('alert_page.html', { 
            title: "Passord error", 
            msg: passwordErrors.join(" "), 
            comefrom: "/account/login" 
        });
    } else {
        try {
            
            const user = await User.findOne({rolling_key: secret_key});
            if (user) {
                user.password = await bcrypt.hash(password, 10);
                await user.save();

                req.session.isUserLoggedIn = true;
                req.session.userId = user._id;
                res.redirect('/dashboard');
            } else {
                req.session.isUserLoggedIn = false;
                return res.render('alert_page.html', { 
                    title: "Bruker ble ikke funnet", 
                    msg: "Klarer ikke å finne bruker", 
                    comefrom: "/account/login" 
                });
            }
        } catch (error) {
            console.error(error);
            return res.render('alert_page.html', { 
                title: "Server error", 
                msg: "error", 
                comefrom: "/account/login" 
            });
        }

    }
});

router.post('/logout', (req, res) => {
    try {
        req.session.isUserLoggedIn = false;
        req.session.userId = "";
        req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
        res.redirect("/account/login");
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', {  
            title: "Server error", 
            msg: "error", 
            comefrom: "/" 
        });
    }
});


module.exports = router;