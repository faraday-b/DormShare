// Import express
const express = require("express");

// Create router
const router = express.Router();

// Import database helper
const db = require("../services/db");

// Route for listings page
router.get("/listings", async function (req, res) {
    try {
        const search = (req.query.search || "").trim();
        const categoryId = (req.query.category || "").trim();
        const params = [];

        let sql = `
            SELECT 
                items.id,
                items.description,
                items.image_data,
                items.title,
                items.points_required,
                items.status,
                categories.name AS category,
                users.username AS owner
            FROM items
            JOIN categories ON items.category_id = categories.id
            JOIN users ON items.user_id = users.id
            WHERE 1 = 1
        `;

        if (search) {
            sql += " AND (items.title LIKE ? OR items.description LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }

        if (categoryId) {
            sql += " AND categories.id = ?";
            params.push(categoryId);
        }

        sql += " ORDER BY items.status ASC, items.title ASC";

        const listings = await db.query(sql, params);
        const categories = await db.query("SELECT id, name FROM categories ORDER BY name");
        const selectedCategory = categories.find(category => String(category.id) === categoryId);
        let recommendedItems = [];

        if (req.currentUser) {
            recommendedItems = await db.query(
                `
                    SELECT
                        items.id,
                        items.title,
                        items.points_required,
                        items.status,
                        categories.name AS category,
                        users.username AS owner
                    FROM items
                    JOIN categories ON items.category_id = categories.id
                    JOIN users ON items.user_id = users.id
                    WHERE items.status = 'Available'
                    AND items.user_id != ?
                    AND items.points_required <= ?
                    ORDER BY
                        CASE WHEN items.category_id IN (
                            SELECT DISTINCT previous_items.category_id
                            FROM borrow_requests
                            JOIN items AS previous_items ON borrow_requests.item_id = previous_items.id
                            WHERE borrow_requests.borrower_id = ?
                        ) THEN 0 ELSE 1 END,
                        items.points_required ASC
                    LIMIT 3
                `,
                [req.currentUser.id, req.currentUser.points, req.currentUser.id]
            );
        }

        res.render("listings", {
            pageTitle: "DormShare Listings",
            listings: listings,
            categories: categories,
            search: search,
            selectedCategory: categoryId,
            selectedCategoryName: selectedCategory ? selectedCategory.name : "",
            recommendedItems
        });

    } catch (err) {
        console.error("Error loading listings:", err);
        res.status(500).send("Server error: Could not load listings.");
    }
});

// Export router
module.exports = router;
