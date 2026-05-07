// Import Express
const express = require("express");

// Create a router object
const router = express.Router();

// Import database helper
const db = require("../services/db");

// Route to display all users
router.get("/users", async (req, res) => {
    try {
        const search = (req.query.search || "").trim();
        const params = [];
        let sql = "SELECT id, username, email, points, is_banned FROM users WHERE is_deleted = 0";

        if (search) {
            sql += " AND (username LIKE ? OR email LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += " ORDER BY username";

        // Run SQL query to get all users from the database
        const users = await db.query(sql, params);

        // Render the users page and pass the data to it
        res.render("users", {
            pageTitle: "User List",
            users: users,
            search: search
        });

    } catch (err) {
        // If something goes wrong, log the error and show message
        console.error("Error fetching users:",err);
        res.status(500).send("Server error: Could not load users. Please try again later.");
    }
});

// Export router so app.js can use it
module.exports = router;
