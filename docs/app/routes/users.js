// Import Express
const express = require("express");

// Create a router object
const router = express.Router();

// Import database helper
const db = require("../services/db");

// Route to display all users
router.get("/users", async (req, res) => {
    try {
        // Run SQL query to get all users from the database
        const users = await db.query(
            "SELECT id, username, email, points FROM users"
        );

        // Render the users page and pass the data to it
        res.render("users", {
            pageTitle: "User List",
            users: users
        });

    } catch (err) {
        // If something goes wrong, log the error and show message
        console.error("Error fetching users:",err);
        res.status(500).send("Server error: Could not load users. Please try again later.");
    }
});

// Export router so app.js can use it
module.exports = router;