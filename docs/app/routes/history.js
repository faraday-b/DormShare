const express = require("express");
const router = express.Router();
const db = require("../services/db");

function requireLogin(req, res, next) {
    if (!req.currentUser) {
        return res.redirect("/login");
    }

    next();
}

router.get("/history", requireLogin, async function(req, res) {
    try {
        const borrowedHistory = await db.query(
            `
                SELECT borrow_requests.id, borrow_requests.status, borrow_requests.points_cost,
                       borrow_requests.return_condition, borrow_requests.created_at,
                       items.title, lender.id AS lender_id, lender.username AS lender_name
                FROM borrow_requests
                JOIN items ON borrow_requests.item_id = items.id
                JOIN users AS lender ON borrow_requests.lender_id = lender.id
                WHERE borrow_requests.borrower_id = ?
                ORDER BY borrow_requests.created_at DESC
            `,
            [req.currentUser.id]
        );

        const lendingHistory = await db.query(
            `
                SELECT borrow_requests.id, borrow_requests.status, borrow_requests.points_cost,
                       borrow_requests.return_condition, borrow_requests.created_at,
                       items.title, borrower.id AS borrower_id, borrower.username AS borrower_name
                FROM borrow_requests
                JOIN items ON borrow_requests.item_id = items.id
                JOIN users AS borrower ON borrow_requests.borrower_id = borrower.id
                WHERE borrow_requests.lender_id = ?
                ORDER BY borrow_requests.created_at DESC
            `,
            [req.currentUser.id]
        );

        res.render("history", {
            pageTitle: "Borrowing History",
            borrowedHistory,
            lendingHistory
        });
    } catch (err) {
        console.error("Error loading history:", err);
        res.status(500).send("Could not load history.");
    }
});

router.get("/history/:id", requireLogin, async function(req, res) {
    const requestId = req.params.id;

    try {
        const records = await db.query(
            `
                SELECT borrow_requests.id, borrow_requests.status, borrow_requests.points_cost,
                       borrow_requests.return_condition, borrow_requests.return_notes,
                       borrow_requests.created_at,
                       items.title, items.description,
                       borrower.id AS borrower_id, borrower.username AS borrower_name,
                       lender.id AS lender_id, lender.username AS lender_name
                FROM borrow_requests
                JOIN items ON borrow_requests.item_id = items.id
                JOIN users AS borrower ON borrow_requests.borrower_id = borrower.id
                JOIN users AS lender ON borrow_requests.lender_id = lender.id
                WHERE borrow_requests.id = ?
                AND (borrow_requests.borrower_id = ? OR borrow_requests.lender_id = ?)
            `,
            [requestId, req.currentUser.id, req.currentUser.id]
        );

        if (records.length === 0) {
            return res.status(404).send("History record not found.");
        }

        const record = records[0];
        const reviews = await db.query(
            `
                SELECT ratings.rating, ratings.comment, ratings.created_at,
                       reviewer.username AS reviewer_name,
                       reviewed.username AS reviewed_name
                FROM ratings
                JOIN users AS reviewer ON ratings.reviewer_id = reviewer.id
                JOIN users AS reviewed ON ratings.reviewed_user_id = reviewed.id
                WHERE
                    (ratings.reviewer_id = ? AND ratings.reviewed_user_id = ?)
                    OR
                    (ratings.reviewer_id = ? AND ratings.reviewed_user_id = ?)
                ORDER BY ratings.created_at DESC
            `,
            [record.borrower_id, record.lender_id, record.lender_id, record.borrower_id]
        );

        res.render("history-details", {
            pageTitle: "History Details",
            record,
            reviews
        });
    } catch (err) {
        console.error("Error loading history details:", err);
        res.status(500).send("Could not load history details.");
    }
});

module.exports = router;
