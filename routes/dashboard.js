const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Subjects = require('../models/subject');
const Rooms = require('../models/room');
const Studietid = require('../models/studietid');
const router = express.Router();
const crypto = require('crypto');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const Global_func = require("../controllers/global_functions");
const multer = require('multer');
const sharp = require('sharp');

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
            comefrom: "/account/login" 
        });
    }
});

router.get('/register_time', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        const rooms = await Rooms.find();
        const subjects = await Subjects.find();
        res.render("dashboard/main_dash.html", {
            windowTitle: "Registrer en økt - Studietid",
            userType: user.type,
            sidebar: findSidebarVersion(user.type),
            main: "register_time_dyna",
            subjects,
            rooms

        })
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/account/login" 
        });
    }
});

router.post('/register-studietid', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.type !== "elev") {
            return res.json({ success: false, message: "Kun elever kan registrere studietid" });
        }

        const { fagId, romId, registreringsdato } = req.body;

        const studietid = new Studietid({
            status: "aktiv",
            user_id: user._id,
            fag_id: fagId,
            rom_id: romId,
            registreringsdato: new Date(registreringsdato),
            kommentar: "none"
        });

        await studietid.save();
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Serverfeil ved registrering av studietid" });
    }
});


router.get('/rooms', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.type != "admin") {
            res.redirect("/dashboard");
        } else {
            const rooms = await Rooms.find();

            res.render("dashboard/main_dash.html", {
                windowTitle: "Oppfør et rom - Studietid",
                userType: user.type,
                sidebar: findSidebarVersion(user.type),
                main: "rooms_dyna",
                rooms

            })
        }
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/account/login" 
        });
    }
});

router.post('/add-room', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.type !== "admin") {
            return res.json({ success: false, message: "Unauthorized" });
        }

        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.json({ success: false, message: "Romnavn kan ikke være tomt" });
        }

        const existingRoom = await Rooms.findOne({ name: name.trim() });
        if (existingRoom) {
            return res.json({ success: false, message: "Dette rommet finnes allerede" });
        }

        const room = new Rooms({ name: name.trim() });
        await room.save();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Serverfeil ved oppretting av rom" });
    }
});

router.delete('/delete-room/:id', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.type !== "admin") {
            return res.json({ success: false, message: "Unauthorized" });
        }

        const room = await Rooms.findByIdAndDelete(req.params.id);
        if (!room) {
            return res.json({ success: false, message: "Rom ikke funnet" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Serverfeil ved sletting av rom" });
    }
});

router.get('/subjects', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.type != "admin") {
            res.redirect("/dashboard");
        } else {
            const subjects = await Subjects.find();

            res.render("dashboard/main_dash.html", {
                windowTitle: "Oppfør et fag - Studietid",
                userType: user.type,
                sidebar: findSidebarVersion(user.type),
                main: "subjects_dyna",
                subjects
            })
        }
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/account/login" 
        });
    }
});

router.post('/add-subject', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.type !== "admin") {
            return res.json({ success: false, message: "Unauthorized" });
        }

        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.json({ success: false, message: "Fagnavn kan ikke være tomt" });
        }

        const existingSubject = await Subjects.findOne({ name: name.trim() });
        if (existingSubject) {
            return res.json({ success: false, message: "Dette faget finnes allerede" });
        }

        const subject = new Subjects({ name: name.trim() });
        await subject.save();

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Serverfeil ved oppretting av fag" });
    }
});

router.delete('/delete-subject/:id', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.type !== "admin") {
            return res.json({ success: false, message: "Unauthorized" });
        }

        const subject = await Subjects.findByIdAndDelete(req.params.id);
        if (!subject) {
            return res.json({ success: false, message: "Fag ikke funnet" });
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: "Serverfeil ved sletting av fag" });
    }
});


router.get('/settings', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);


        res.render("dashboard/main_dash.html", {
            windowTitle: "Innstillinger - Studietid",
            userType: user.type,
            sidebar: findSidebarVersion(user.type),
            main: "settings_dyna",
            user

        })
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/account/login" 
        });
    }
});

router.post('/delete_account', isAuthenticated, async (req, res) => {
    try {
        let { password } = req.body; 

        let user = await User.findById(req.session.userId);
        if (user) {
            const passwordMatch = await bcrypt.compare(password, user.password);
            if (passwordMatch) {

                await User.findByIdAndDelete(user._id);

                req.session.isUserLoggedIn = false;
                req.session.userId = "";
                req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
                res.redirect("/account/login");
            } else {
                return res.render('alert_page.html', { 
                    title: "Feil passord!", 
                    msg: "Kunne ikke slette brukeren din, på grunn av feil passord. Prøv igjen.", 
                    comefrom: "/dashboard/settings" 
                });
            }
        } else {
            return res.render('alert_page.html', { 
                title: "Kan ikke finne brukeren.", 
                msg: "Finner ikke brukeren.", 
                comefrom: "/dashboard/settings" 
            });
        }
    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/dashboard/settings" 
        });
    }
});

router.post('/settings_update_basic_info', isAuthenticated, async (req, res) => {
    try {
        let { settings_basic_name } = req.body; 
        let user = await User.findById(req.session.userId);
        try {

            user.name = settings_basic_name;

            await user.save();

            res.redirect("/dashboard/settings")
        } catch {
            return res.render('alert_page.html', { 
                title: "Klarte ikke.", 
                msg: "Klarte ikke å fullføre endringen.", 
                comefrom: "/dashboard/settings" 
            });
        }

    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/dashboard/settings" 
        });
    }
});

router.post('/settings_update_profile_pic', Global_func.upload_image.single('image'), isAuthenticated, async (req, res) => {
    try {
        let user = await User.findById(req.session.userId);

        let imageData;
        if (req.file && req.file.buffer) {
            imageData = req.file.buffer;
        } else {
            imageData = null;
            console.log("no image")
        }


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

        user.pfp_data = pfp_data_var;

        await user.save();
        
        res.redirect("/dashboard")

    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/dashboard/settings" 
        });
    }
});

router.post('/settings_update_email', isAuthenticated, async (req, res) => {
    try {
        let { settings_basic_email, settings_basic_password } = req.body; 
        let user = await User.findById(req.session.userId);
        try {
            const passwordMatch = await bcrypt.compare(settings_basic_password, user.password);
            if (passwordMatch) {
                const existingUser = await User.findOne({ email: settings_basic_email });
                if (existingUser) {
                    return res.render('alert_page.html', { 
                        title: "Finnes allerede.", 
                        msg: "Denne e-posten finnes allerede i systemene våre.", 
                        comefrom: "/dashboard/settings" 
                    });
                } else {

                    user.email = settings_basic_email;

                    await user.save();

                    res.redirect("/dashboard");
                }
            } else {
                return res.render('alert_page.html', { 
                    title: "Feil passord.", 
                    msg: "Kunne ikke oppdatere brukeren din, på grunn av feil passord.", 
                    comefrom: "/dashboard/settings" 
                });
            }
        } catch {
            return res.render('alert_page.html', { 
                title: "Klarte ikke.", 
                msg: "Klarte ikke å fullføre endringen.", 
                comefrom: "/dashboard/settings" 
            });
        }

    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/dashboard/settings" 
        });
    }
});

router.post('/settings_update_password', isAuthenticated, async (req, res) => {
    try {
        let { settings_basic_password_new, settings_basic_password_new_repeat, settings_basic_password_original } = req.body; 
        let user = await User.findById(req.session.userId);
        try {
            const passwordErrors = [];
            if (settings_basic_password_new.length < 8) {
                passwordErrors.push("Passordet må være minst 8 tegn.");
            }
            if (!/\d/.test(settings_basic_password_new)) {
                passwordErrors.push("Passordet må inneholde 1 tall.");
            }
            if (settings_basic_password_new !== settings_basic_password_new_repeat) {
                passwordErrors.push("De to passord feltene er ikke like.");
            }

            if (passwordErrors.length > 0) {
                return res.render('alert_page.html', { 
                    title: "Oisann...", 
                    msg: passwordErrors.join(" "), 
                    comefrom: "/dashboard/settings" 
                });
            } else {
                const passwordMatch = await bcrypt.compare(settings_basic_password_original, user.password);
                if (passwordMatch) {
                    user.password = await bcrypt.hash(settings_basic_password_new, 10);
                    await user.save();
                    res.redirect("/dashboard");
                } else {
                    return res.render('alert_page.html', { 
                        title: "Feil passord.", 
                        msg: "Kunne ikke oppdatere brukeren din, på grunn av feil passord.", 
                        comefrom: "/dashboard/settings" 
                    });
                }
            }
        } catch {
            return res.render('alert_page.html', { 
                title: "Klarte ikke.", 
                msg: "Klarte ikke å fullføre endringen.", 
                comefrom: "/dashboard/settings" 
            });
        }

    } catch (error) {
        console.error(error);
        return res.render('alert_page.html', { 
            title: "Server error", 
            msg: "error", 
            comefrom: "/dashboard/settings" 
        });
    }
});


module.exports = router;