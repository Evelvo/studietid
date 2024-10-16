const prompt = require('prompt-sync')();
const bcrypt = require('bcryptjs');

// Get password from user input
const password = prompt("Password: ");

// Hash the password asynchronously
bcrypt.hash(password, 10)
    .then((hashedPassword) => {
        // Log the hashed password
        console.log(hashedPassword);
    })
    .catch((error) => {
        // Handle any errors
        console.error("Error hashing password:", error);
    });
