const express = require("express");
const router = express.Router();
const db = require("../services/db");

function requireLogin(req, res, next) {
    if (!req.currentUser) {
        return res.redirect("/login");
    }

    next();
}

router.post("/user/:id/rate", requireLogin, async function(req, res) {
    const reviewedUserId = req.params.id;
    const rating = Number(req.body.rating);
    const comment = (req.body.comment || "").trim();

    try {
        if (Number(reviewedUserId) === Number(req.currentUser.id)) {
            throw new Error("You cannot rate yourself.");
        }

        if (!rating || rating < 1 || rating > 5) {
            throw new Error("Rating must be between 1 and 5.");
        }

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
            [req.currentUser.id, reviewedUserId, reviewedUserId, req.currentUser.id]
        );

        if (completedInteractions.length === 0) {
            throw new Error("You can only rate users after a completed returned borrow or lend.");
        }

        await db.query(
            `
                INSERT INTO ratings (reviewer_id, reviewed_user_id, rating, comment)
                VALUES (?, ?, ?, ?)
            `,
            [req.currentUser.id, reviewedUserId, rating, comment]
        );

        res.redirect(`/user/${reviewedUserId}/profile?rated=true`);
    } catch (err) {
        console.error("Error saving rating:", err);
        res.redirect(`/user/${reviewedUserId}/profile?ratingError=${encodeURIComponent(err.message)}`);
    }
});

module.exports = router;
