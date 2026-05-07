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

function isUniversityEmail(email) {
    return email.toLowerCase().endsWith("@roehampton.ac.uk");
}

function setLoginCookie(res, userId) {
    res.setHeader("Set-Cookie", `userId=${userId}; HttpOnly; Path=/; SameSite=Lax`);
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

        if (!isUniversityEmail(email)) {
            return res.render("register", {
                pageTitle: "Create Account",
                error: "Please register using your Roehampton university email address."
            });
        }

        if (!isStrongPassword(password)) {
            return res.render("register", {
                pageTitle: "Create Account",
                error: "Password must be at least 8 characters and include one capital letter, one number, and one special character."
            });
        }

        const existingUser = await db.query(
            "SELECT id FROM users WHERE email = ? AND is_deleted = 0",
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
            "SELECT id, username, email, points, password_hash, is_banned, is_deleted FROM users WHERE email = ?",
            [email]
        );

        if (users.length === 0) {
            return res.render("login", {
                pageTitle: "Login",
                error: "Invalid email or password."
            });
        }

        const user = users[0];

        if (user.is_deleted) {
            return res.render("login", {
                pageTitle: "Login",
                error: "This account has been deleted."
            });
        }

        if (user.is_banned) {
            return res.render("login", {
                pageTitle: "Login",
                error: "This account has been banned because of repeated reports."
            });
        }

        let passwordMatches = false;

        if (!user.password_hash) {
            passwordMatches = false;
        } else if (user.password_hash.startsWith("$2")) {
            passwordMatches = await bcrypt.compare(password, user.password_hash);
        } else {
            passwordMatches = password === user.password_hash;
        }

        if (!passwordMatches) {
            return res.render("login", {
                pageTitle: "Login",
                error: "Invalid email or password."
            });
        }

        setLoginCookie(res, user.id);
        res.redirect("/");

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).send("Server error: Could not log in.");
    }
});

router.get("/logout", function(req, res) {
    res.setHeader("Set-Cookie", "userId=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
    res.redirect("/login");
});

module.exports = router;
