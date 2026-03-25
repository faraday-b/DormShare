const express = require("express");
const router = express.Router();

router.get("/listings", function (req, res) {
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

    res.render("listings", {
        title: "DormShare Listings",
        listings: listings
    });
});

module.exports = router;