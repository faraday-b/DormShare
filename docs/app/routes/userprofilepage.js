const express = require('express');
const router = express.Router();

const db = require('../services/db'); 

router.get("/profile", function(req, res) {
    if (!req.currentUser) {
        return res.redirect("/login");
    }

    res.redirect(`/user/${req.currentUser.id}/profile`);
});

// User profile route: /user/:id/profile
router.get("/user/:id/profile", async function(req, res) {
    var userId = req.params.id; 

    // Querying your Users table for the specific ID
    var sql = 'SELECT id, username, email, points, profile_image, report_count, is_banned, is_deleted FROM users WHERE id = ? AND is_deleted = 0';

    // Ensure db exists before calling .query()
    if (!db || typeof db.query !== 'function') {
        console.error("Database connection 'db' is not initialized correctly.");
        return res.status(500).send("Database configuration error.");
    }

    db.query(sql, [userId]).then(async results => {
        if (results && results.length > 0) {
            const ratings = await db.query(
                `
                    SELECT ratings.rating, ratings.comment, ratings.created_at, users.username AS reviewer_name
                    FROM ratings
                    JOIN users ON ratings.reviewer_id = users.id
                    WHERE ratings.reviewed_user_id = ?
                    ORDER BY ratings.created_at DESC
                `,
                [userId]
            );

            const averageRating = ratings.length
                ? (ratings.reduce((total, rating) => total + Number(rating.rating), 0) / ratings.length).toFixed(1)
                : null;
            let canRate = false;

            if (req.currentUser && Number(req.currentUser.id) !== Number(userId)) {
                const completedInteractions = await db.query(
                    `
                        SELECT id
                        FROM borrow_requests
                        WHERE status = 'Returned'
                        AND (
                            (borrower_id = ? AND lender_id = ?)
                            OR
                            (borrower_id = ? AND lender_id = ?)
                        )
                        LIMIT 1
                    `,
                    [req.currentUser.id, userId, userId, req.currentUser.id]
                );

                canRate = completedInteractions.length > 0;
            }

            // Render the 'profile.pug' template with the database results
            res.render('profile', { 
                pageTitle: results[0].username + ' - DormShare', 
                data: results[0],
                ratings,
                averageRating,
                canRate,
                isOwnProfile: req.currentUser && Number(req.currentUser.id) === Number(userId),
                success: req.query.updated === "true",
                rated: req.query.rated === "true",
                messageSent: req.query.messageSent === "true",
                messageError: req.query.messageError || null,
                reported: req.query.reported === "true",
                reportError: req.query.reportError || null,
                ratingError: req.query.ratingError || null,
                deleteError: req.query.deleteError || null,
                error: null
            });
        } else {
            res.status(404).send("User not found in our system.");
        }
    }).catch(err => {
        console.error("Database error:", err);
        res.status(500).send("Internal Server Error");
    });
});

router.post("/user/:id/profile", async function(req, res) {
    const userId = req.params.id;

    if (!req.currentUser || Number(req.currentUser.id) !== Number(userId)) {
        return res.status(403).send("You can only update your own profile.");
    }

    try {
        const username = req.body.username;
        const email = req.body.email;
        const profileImage = req.body.profile_image;

        if (!username || !email) {
            return res.status(400).send("Username and email are required.");
        }

        if (profileImage) {
            await db.query(
                "UPDATE users SET username = ?, email = ?, profile_image = ? WHERE id = ?",
                [username, email, profileImage, userId]
            );
        } else {
            await db.query(
                "UPDATE users SET username = ?, email = ? WHERE id = ?",
                [username, email, userId]
            );
        }

        res.redirect(`/user/${userId}/profile?updated=true`);
    } catch (err) {
        console.error("Profile update error:", err);
        res.status(500).send("Could not update profile.");
    }
});

router.post("/user/:id/delete", async function(req, res) {
    const userId = req.params.id;

    if (!req.currentUser || Number(req.currentUser.id) !== Number(userId)) {
        return res.status(403).send("You can only delete your own account.");
    }

    try {
        await db.transaction(async (connection) => {
            const [borrowedItems] = await connection.execute(
                `
                    SELECT id
                    FROM borrow_requests
                    WHERE (borrower_id = ? OR lender_id = ?)
                    AND status = 'Borrowed'
                    LIMIT 1
                `,
                [userId, userId]
            );

            if (borrowedItems.length > 0) {
                throw new Error("You cannot delete your account while an item is currently borrowed. Return or confirm the item first.");
            }

            const [lenderRequested] = await connection.execute(
                `
                    SELECT id, borrower_id, points_cost
                    FROM borrow_requests
                    WHERE lender_id = ?
                    AND status = 'Requested'
                `,
                [userId]
            );

            for (const request of lenderRequested) {
                await connection.execute(
                    "UPDATE users SET points = points + ? WHERE id = ?",
                    [request.points_cost, request.borrower_id]
                );
            }

            await connection.execute(
                `
                    UPDATE borrow_requests
                    SET status = 'Cancelled'
                    WHERE (borrower_id = ? OR lender_id = ?)
                    AND status = 'Requested'
                `,
                [userId, userId]
            );

            await connection.execute(
                "UPDATE items SET status = 'Cancelled' WHERE user_id = ? AND status IN ('Available', 'Requested')",
                [userId]
            );

            await connection.execute(
                "UPDATE messages SET status = 'Deleted' WHERE sender_id = ? OR receiver_id = ?",
                [userId, userId]
            );

            await connection.execute(
                `
                    UPDATE users
                    SET username = ?,
                        email = ?,
                        password_hash = '',
                        points = 0,
                        profile_image = NULL,
                        is_deleted = 1
                    WHERE id = ?
                `,
                [`Deleted User ${userId}`, `deleted_user_${userId}@deleted.local`, userId]
            );
        });

        res.setHeader("Set-Cookie", "userId=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
        res.redirect("/login");
    } catch (err) {
        console.error("Account deletion error:", err);
        res.redirect(`/user/${userId}/profile?deleteError=${encodeURIComponent(err.message)}`);
    }
});

module.exports = router;
