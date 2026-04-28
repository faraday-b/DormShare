// Import express
const express = require("express");

// Create router
const router = express.Router();

// Import database helper
const db = require("../services/db");

// Route for listings page
router.get("/listings", async function (req, res) {
    try {
        const sql = `
            SELECT 
                items.id,
                items.title,
                items.points_required,
                items.status,
                categories.name AS category
            FROM items
            JOIN categories ON items.category_id = categories.id
        `;

        const listings = await db.query(sql);

        res.render("listings", {
            pageTitle: "DormShare Listings",
            listings: listings
        });

    } catch (err) {
        console.error("Error loading listings:", err);
        res.status(500).send("Server error: Could not load listings.");
    }
});

// Export router
module.exports = router;