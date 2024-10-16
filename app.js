const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const app = express();
const dotenv = require("dotenv");
const MongoStore = require('connect-mongo');
const User = require('./models/user');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const port = process.env.PORT;
const express_secret_key = process.env.EXPRESS_SECRET_KEY;

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

app.set('trust proxy', 1);

app.use(session({
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        collectionName: 'sessions',
        ttl: 30 * 24 * 60 * 60, // 30 dager
    }),
    secret: express_secret_key,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.PRODUCTION === "PRODUCTION", 
        maxAge: 72 * 60 * 60 * 1000, // 72 timer
        sameSite: 'lax'
    }
}));


app.use(bodyParser.json());

async function navbar_data(req, res, next) {
    let pfp_data_var = "none"
    if (req.session.isUserLoggedIn) {
        const user = await User.findById(req.session.userId);
        if (user) {
            pfp_data_var = user.pfp_data;
        }

    }

    
    res.locals.pfp_data = pfp_data_var;
    next();
}

app.use(navbar_data);

app.use((req, res, next) => {
    if (!req.session.user) {
        req.session.user = { initialized: true };
    }
    next();
});


app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.set('views', path.join(__dirname, 'public', 'templates'));
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

const accountRoutes = require('./routes/account');
const dashboardRoutes = require('./routes/dashboard');

app.use('/account', accountRoutes);
app.use('/dashboard', dashboardRoutes);

app.get('/', async (req, res) => {
    res.redirect("/dashboard");
});

process.on('SIGINT', () => {
    mongoose.connection.close(() => {
        console.log('MongoDB disconnected through app termination');
        process.exit(0);
    });
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

//app.listen(port, "0.0.0.0" ,() => {
//    console.log(`Server running at http://localhost:${port}`);
//});

