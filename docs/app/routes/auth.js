const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../services/db");

// Checks password strength
function isStrongPassword(password) {
    return password.length >= 8 &&
           /[A-Z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[^A-Za-z0-9]/.test(password);
}

// Show register page
router.get("/register", function(req, res) {
    res.render("register", {
        pageTitle: "Create Account",
        error: null
    });
});

// Handle register form
router.post("/register", async function(req, res) {
    try {
        const username = req.body.username;
        const email = req.body.email;
        const password = req.body.password;

        if (!isStrongPassword(password)) {
            return res.render("register", {
                pageTitle: "Create Account",
                error: "Password must be at least 8 characters and include one capital letter, one number, and one special character."
            });
        }

        const existingUser = await db.query(
            "SELECT id FROM users WHERE email = ?",
            [email]
        );

        if (existingUser.length > 0) {
            return res.render("register", {
                pageTitle: "Create Account",
                error: "An account with this email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            "INSERT INTO users (username, email, password_hash, points) VALUES (?, ?, ?, ?)",
            [username, email, hashedPassword, 50]
        );

        res.redirect("/login");

    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).send("Server error: Could not create account.");
    }
});

// Show login page
router.get("/login", function(req, res) {
    res.render("login", {
        pageTitle: "Login",
        error: null
    });
});

// Handle login form
router.post("/login", async function(req, res) {
    try {
        const email = req.body.email;
        const password = req.body.password;

        const users = await db.query(
            "SELECT id, username, email, points, password_hash FROM users WHERE email = ?",
            [email]
        );

        if (users.length === 0) {
            return res.render("login", {
                pageTitle: "Login",
                error: "Invalid email or password."
            });
        }

        const user = users[0];

        const passwordMatches = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatches) {
            return res.render("login", {
                pageTitle: "Login",
                error: "Invalid email or password."
            });
        }

        res.redirect(`/user/${user.id}/profile`);

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).send("Server error: Could not log in.");
    }
});

module.exports = router;