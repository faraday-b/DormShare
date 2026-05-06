const express = require("express");
const router = express.Router();
const db = require("../services/db");

router.get("/new", async function(req, res) {
    if (!req.currentUser) {
        return res.redirect("/login");
    }

    try {
        const categories = await db.query("SELECT id, name FROM categories ORDER BY name");

        res.render("new-item", {
            pageTitle: "Lend an Item",
            categories,
            error: null
        });
    } catch (err) {
        console.error("Error loading lend item page:", err);
        res.status(500).send("Could not load lend item page.");
    }
});

router.post("/new", async function(req, res) {
    if (!req.currentUser) {
        return res.redirect("/login");
    }

    try {
        const title = req.body.title;
        const description = req.body.description;
        const categoryId = req.body.category_id;
        const pointsRequired = Number(req.body.points_required);
        const itemCondition = req.body.item_condition;
        const pickupLocation = req.body.pickup_location;
        const availabilityNotes = req.body.availability_notes || "";
        const imageData = req.body.item_image || null;

        if (!title || !description || !categoryId || !pointsRequired || pointsRequired < 1 || !itemCondition || !pickupLocation) {
            const categories = await db.query("SELECT id, name FROM categories ORDER BY name");

            return res.render("new-item", {
                pageTitle: "Lend an Item",
                categories,
                error: "Please complete all required fields and enter a valid points cost."
            });
        }

        await db.query(
            `
                INSERT INTO items
                (title, description, category_id, user_id, points_required, status, image_data, item_condition, pickup_location, availability_notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [title, description, categoryId, req.currentUser.id, pointsRequired, "Available", imageData, itemCondition, pickupLocation, availabilityNotes]
        );

        res.redirect("/listings");
    } catch (err) {
        console.error("Error creating item:", err);
        res.status(500).send("Could not list item.");
    }
});

router.post("/:id/cancel-listing", async function(req, res) {
    const itemId = req.params.id;

    if (!req.currentUser) {
        return res.redirect("/login");
    }

    try {
        await db.transaction(async (connection) => {
            const [items] = await connection.execute(
                "SELECT id, user_id, status FROM items WHERE id = ? FOR UPDATE",
                [itemId]
            );

            const item = items[0];

            if (!item) {
                throw new Error("Item not found.");
            }

            if (Number(item.user_id) !== Number(req.currentUser.id)) {
                throw new Error("Only the owner can cancel this listing.");
            }

            if (item.status !== "Available") {
                throw new Error("Only available listings can be cancelled.");
            }

            await connection.execute(
                "UPDATE items SET status = ? WHERE id = ?",
                ["Cancelled", item.id]
            );
        });

        res.redirect(`/items/${itemId}?success=Listing cancelled`);
    } catch (err) {
        console.error("Error cancelling listing:", err);
        res.redirect(`/items/${itemId}?error=${encodeURIComponent(err.message)}`);
    }
});

// Item Details route
router.get("/:id", function (req, res) {
    const itemId = req.params.id;

    const sql = `
        SELECT 
            items.id,
            items.title,
            items.description,
            items.image_data,
            items.item_condition,
            items.pickup_location,
            items.availability_notes,
            items.points_required,
            items.status,
            items.user_id,
            categories.name AS category,
            users.id AS owner_id,
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
                item: item,
                success: req.query.success || null,
                error: req.query.error || null
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

    if (!req.currentUser) {
        return res.redirect("/login");
    }

    db.transaction(async (connection) => {
        const [items] = await connection.execute(
            `
                SELECT id, user_id, points_required, status
                FROM items
                WHERE id = ?
                FOR UPDATE
            `,
            [itemId]
        );

        if (items.length === 0) {
            throw new Error("Item not found.");
        }

        const item = items[0];

        if (item.status !== "Available") {
            throw new Error("This item is not available.");
        }

        if (Number(item.user_id) === Number(req.currentUser.id)) {
            throw new Error("You cannot request your own item.");
        }

        const [borrowers] = await connection.execute(
            "SELECT id, points FROM users WHERE id = ? FOR UPDATE",
            [req.currentUser.id]
        );

        const borrower = borrowers[0];

        if (!borrower || borrower.points < item.points_required) {
            throw new Error("You do not have enough points to request this item.");
        }

        await connection.execute(
            "UPDATE users SET points = points - ? WHERE id = ?",
            [item.points_required, req.currentUser.id]
        );

        await connection.execute(
            `
                INSERT INTO borrow_requests
                (item_id, borrower_id, lender_id, status, points_cost)
                VALUES (?, ?, ?, ?, ?)
            `,
            [item.id, req.currentUser.id, item.user_id, "Requested", item.points_required]
        );

        await connection.execute(
            "UPDATE items SET status = ? WHERE id = ?",
            ["Requested", item.id]
        );
    })
    .then(() => {
        res.redirect("/requests");
    })
    .catch((err) => {
        console.error("Error requesting item:", err);
        res.redirect(`/items/${itemId}?error=${encodeURIComponent(err.message)}`);
    });
});

module.exports = router;
