const express = require("express");
const router = express.Router();
const db = require("../services/db");

// Item Details route
router.get("/:id", function (req, res) {
    const itemId = req.params.id;

    const sql = `
        SELECT 
            items.id,
            items.title,
            items.description,
            items.points_required,
            items.status,
            categories.name AS category,
            users.username AS owner
        FROM items
        JOIN categories ON items.category_id = categories.id
        JOIN users ON items.user_id = users.id
        WHERE items.id = ?
    `;

    db.query(sql, [itemId])
        .then((results) => {
            const item = results[0];

            if (!item) {
                return res.status(404).send("Item not found");
            }

            res.render("item-details", {
                pageTitle: "Item Details",
                item: item
            });
        })
        .catch((err) => {
            console.error("Error loading item details:", err);
            res.status(500).send("Error loading item details");
        });
});

// Request item route
router.post("/:id/request", function (req, res) {
    const itemId = req.params.id;

    const sql = "UPDATE items SET status = ? WHERE id = ?";

    db.query(sql, ["Requested", itemId])
        .then(() => {
            res.redirect("/items/" + itemId);
        })
        .catch((err) => {
            console.error("Error requesting item:", err);
            res.status(500).send("Error requesting item");
        });
});

module.exports = router;