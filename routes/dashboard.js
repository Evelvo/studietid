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
        if (user.type == "admin") {
            const studySessions = await Studietid.find()
                .populate('fag_id')
                .populate('rom_id')
                .populate({
                    path: 'user_id',
                    model: 'User',
                    select: 'name email'
                })
                .sort('-registreringsdato');

            const sessionsByStatus = {
                aktiv: studySessions.filter(session => session.status === 'aktiv'),
                godkjent: studySessions.filter(session => session.status === 'godkjent'),
                avvist: studySessions.filter(session => session.status === 'avvist')
            };

            res.render("dashboard/main_dash.html", {
                windowTitle: "Dashbord - Studietid",
                userType: user.type,
                sidebar: findSidebarVersion(user.type),
                main: "approve_studietid_dyna",
                studySessions: studySessions,
                sessionsByStatus: sessionsByStatus
            });
        } else {
            const studySessions = await Studietid.find({ user_id: req.session.userId })
                .populate('fag_id')
                .populate('rom_id')
                .sort('-registreringsdato');

            let totalHours = 0;
            let approvedSessions = 0;
            let pendingSessions = 0;

            studySessions.forEach(session => {
                if (session.status === 'godkjent' && session.ferdigdato) {
                    const hours = (new Date(session.ferdigdato) - new Date(session.registreringsdato)) / (1000 * 60 * 60);
                    totalHours += Math.round(hours * 10) / 10;
                    approvedSessions++;
                } else if (session.status === 'aktiv') {
                    pendingSessions++;
                }
            });

            res.render("dashboard/main_dash.html", {
                windowTitle: "Dashbord - Studietid",
                userType: user.type,
                sidebar: findSidebarVersion(user.type),
                main: "home_dyna",
                studySessions,
                totalHours,
                approvedSessions,
                pendingSessions,
                formatDate: (date) => {
                    return new Date(date).toLocaleString('no-NO', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
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


router.post('/update-study-session', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.type !== "admin") {
            return res.json({ success: false, message: "Unauthorized" });
        }

        const { sessionId, status, comment } = req.body;
        

        const studietid = await Studietid.findById(sessionId);
        if (!studietid) {
            return res.json({ success: false, message: "Studieøkt ikke funnet" });
        }

        if (studietid.status !== 'aktiv') {
            return res.json({ 
                success: false, 
                message: "Kan ikke endre status på en allerede godkjent eller avvist studieøkt" 
            });
        }

        const updates = {
            status: status,
            kommentar: comment && comment !== '' ? comment : 'none',
            ferdigdato: new Date()
        };

        const updatedSession = await Studietid.findByIdAndUpdate(
            sessionId,
            updates,
            { new: true, runValidators: true }
        );

        if (!updatedSession) {
            return res.json({ 
                success: false, 
                message: "Kunne ikke oppdatere studieøkten" 
            });
        }

        res.json({ 
            success: true,
            message: status === 'godkjent' ? 'Studieøkt godkjent' : 'Studieøkt avvist',
            session: updatedSession 
        });

    } catch (error) {
        console.error('Error in update-study-session:', error);
        res.json({ 
            success: false, 
            message: "En feil oppstod ved oppdatering av studieøkten" 
        });
    }
});

router.get('/get-study-session/:id', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.type !== "admin") {
            return res.json({ success: false, message: "Unauthorized" });
        }

        const session = await Studietid.findById(req.params.id)
            .populate('fag_id')
            .populate('rom_id')
            .populate({
                path: 'user_id',
                model: 'User',
                select: 'name email'
            });

        if (!session) {
            return res.json({ success: false, message: "Studieøkt ikke funnet" });
        }

        res.json({ success: true, session });
    } catch (error) {
        console.error('Error in get-study-session:', error);
        res.json({ 
            success: false, 
            message: "En feil oppstod ved henting av studieøkten" 
        });
    }
});


router.get('/users', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.type != "admin") {
            res.redirect("/dashboard");
        } else {
        const users = await User.find(); // Hent alle brukere
            res.render("dashboard/main_dash.html", {
                windowTitle: "Alle brukere - Studietid",
                userType: user.type,
                sidebar: findSidebarVersion(user.type),
                main: "users_list",
                users
            });
        }
    } catch (error) {
        console.error(error);
        res.render('alert_page.html', { 
            title: "Server error", 
            msg: "Kunne ikke hente brukere.", 
            comefrom: "/dashboard" 
        });
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