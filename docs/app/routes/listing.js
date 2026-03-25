// Import express
const express = require("express");

// Create router
const router = express.Router();

// Route for listings page
router.get("/listings", function (req, res) {

    // Sample data (temporary until database is used)
    const listings = [
        {
            id: 1,
            title: "Laptop Charger",
            category: "Electronics",
            points: "Available"
        },
        {
            id: 2,
            title: "Blender",
            category: "Kitchen",
            points: "Available"
        },
        {
            id: 3,
            title: "Notebook Set",
            category: "Studying",
            points: "Available"
        },
        {
            id: 4,
            title: "Jacket",
            category: "Clothing",
            points: "Available"
        }
    ];

    // Render page and send data
    res.render("listings", {
        title: "DormShare Listings",
        listings: listings
    });
});

// Export router
module.exports = router;