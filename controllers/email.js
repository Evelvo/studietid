const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const dotenv = require("dotenv");
const hbs = require('nodemailer-express-handlebars');
const path = require('path');

dotenv.config();

async function send_email(receiver, subject, templateName, context) {
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

    sgMail.setApiKey(SENDGRID_API_KEY);

    const transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
            user: 'apikey',
            pass: SENDGRID_API_KEY,
        },
    });

    const handlebarOptions = {
        viewEngine: {
            extName: '.handlebars',
            partialsDir: path.resolve('./controllers/email_templates'),
            defaultLayout: false,
        },
        viewPath: path.resolve('./controllers/email_templates'),
        extName: '.handlebars',
    };

    transporter.use('compile', hbs(handlebarOptions));

    const mailOptions = {
        from: '"Studietid" <everyone@evelvo.tech>',
        to: receiver,
        subject: subject,
        template: templateName,
        context: context,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
        } else {
            console.log('Email sent:', info.response);
        }
    });
}

module.exports = { send_email };
