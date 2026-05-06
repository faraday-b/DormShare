const express = require("express");
const router = express.Router();
const db = require("../services/db");

function requireLogin(req, res, next) {
    if (!req.currentUser) {
        return res.redirect("/login");
    }

    next();
}

router.get("/requests", requireLogin, async function(req, res) {
    try {
        const borrowedRequests = await db.query(
            `
                SELECT
                    borrow_requests.id,
                    borrow_requests.status,
                    borrow_requests.points_cost,
                    borrow_requests.created_at,
                    items.title,
                    lender.id AS lender_id,
                    lender.username AS lender_name,
                    borrower.username AS borrower_name
                FROM borrow_requests
                JOIN items ON borrow_requests.item_id = items.id
                JOIN users AS lender ON borrow_requests.lender_id = lender.id
                JOIN users AS borrower ON borrow_requests.borrower_id = borrower.id
                WHERE borrow_requests.borrower_id = ?
                ORDER BY borrow_requests.created_at DESC
            `,
            [req.currentUser.id]
        );

        const lendingRequests = await db.query(
            `
                SELECT
                    borrow_requests.id,
                    borrow_requests.status,
                    borrow_requests.points_cost,
                    borrow_requests.created_at,
                    items.title,
                    borrower.id AS borrower_id,
                    lender.username AS lender_name,
                    borrower.username AS borrower_name
                FROM borrow_requests
                JOIN items ON borrow_requests.item_id = items.id
                JOIN users AS lender ON borrow_requests.lender_id = lender.id
                JOIN users AS borrower ON borrow_requests.borrower_id = borrower.id
                WHERE borrow_requests.lender_id = ?
                ORDER BY borrow_requests.created_at DESC
            `,
            [req.currentUser.id]
        );

        res.render("requests", {
            pageTitle: "Borrow Requests",
            borrowedRequests,
            lendingRequests,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error("Error loading requests:", err);
        res.status(500).send("Could not load requests.");
    }
});

router.post("/requests/:id/approve", requireLogin, async function(req, res) {
    const requestId = req.params.id;

    try {
        await db.transaction(async (connection) => {
            const [requests] = await connection.execute(
                `
                    SELECT borrow_requests.id, borrow_requests.item_id, borrow_requests.lender_id, borrow_requests.status
                    FROM borrow_requests
                    WHERE borrow_requests.id = ?
                    FOR UPDATE
                `,
                [requestId]
            );

            const request = requests[0];

            if (!request) {
                throw new Error("Request not found.");
            }

            if (Number(request.lender_id) !== Number(req.currentUser.id)) {
                throw new Error("Only the lender can approve this request.");
            }

            if (request.status !== "Requested") {
                throw new Error("This request cannot be approved now.");
            }

            await connection.execute(
                "UPDATE borrow_requests SET status = ? WHERE id = ?",
                ["Borrowed", request.id]
            );

            await connection.execute(
                "UPDATE items SET status = ? WHERE id = ?",
                ["Borrowed", request.item_id]
            );
        });

        res.redirect("/requests?success=Request approved");
    } catch (err) {
        console.error("Error approving request:", err);
        res.redirect(`/requests?error=${encodeURIComponent(err.message)}`);
    }
});

router.post("/requests/:id/cancel", requireLogin, async function(req, res) {
    const requestId = req.params.id;

    try {
        await db.transaction(async (connection) => {
            const [requests] = await connection.execute(
                `
                    SELECT id, item_id, borrower_id, status, points_cost
                    FROM borrow_requests
                    WHERE id = ?
                    FOR UPDATE
                `,
                [requestId]
            );

            const request = requests[0];

            if (!request) {
                throw new Error("Request not found.");
            }

            if (Number(request.borrower_id) !== Number(req.currentUser.id)) {
                throw new Error("Only the borrower can cancel this request.");
            }

            if (request.status !== "Requested") {
                throw new Error("Only pending requests can be cancelled.");
            }

            await connection.execute(
                "UPDATE users SET points = points + ? WHERE id = ?",
                [request.points_cost, request.borrower_id]
            );

            await connection.execute(
                "UPDATE borrow_requests SET status = ? WHERE id = ?",
                ["Cancelled", request.id]
            );

            await connection.execute(
                "UPDATE items SET status = ? WHERE id = ?",
                ["Available", request.item_id]
            );
        });

        res.redirect("/requests?success=Request cancelled and points refunded");
    } catch (err) {
        console.error("Error cancelling request:", err);
        res.redirect(`/requests?error=${encodeURIComponent(err.message)}`);
    }
});

router.post("/requests/:id/reject", requireLogin, async function(req, res) {
    const requestId = req.params.id;

    try {
        await db.transaction(async (connection) => {
            const [requests] = await connection.execute(
                `
                    SELECT id, item_id, borrower_id, lender_id, status, points_cost
                    FROM borrow_requests
                    WHERE id = ?
                    FOR UPDATE
                `,
                [requestId]
            );

            const request = requests[0];

            if (!request) {
                throw new Error("Request not found.");
            }

            if (Number(request.lender_id) !== Number(req.currentUser.id)) {
                throw new Error("Only the lender can reject this request.");
            }

            if (request.status !== "Requested") {
                throw new Error("Only pending requests can be rejected.");
            }

            await connection.execute(
                "UPDATE users SET points = points + ? WHERE id = ?",
                [request.points_cost, request.borrower_id]
            );

            await connection.execute(
                "UPDATE borrow_requests SET status = ? WHERE id = ?",
                ["Rejected", request.id]
            );

            await connection.execute(
                "UPDATE items SET status = ? WHERE id = ?",
                ["Available", request.item_id]
            );
        });

        res.redirect("/requests?success=Request rejected and points refunded");
    } catch (err) {
        console.error("Error rejecting request:", err);
        res.redirect(`/requests?error=${encodeURIComponent(err.message)}`);
    }
});

router.post("/requests/:id/return-good", requireLogin, async function(req, res) {
    const requestId = req.params.id;
    const borrowerReward = 2;
    const lenderBonus = 5;

    try {
        await db.transaction(async (connection) => {
            const [requests] = await connection.execute(
                `
                    SELECT
                        borrow_requests.id,
                        borrow_requests.item_id,
                        borrow_requests.borrower_id,
                        borrow_requests.lender_id,
                        borrow_requests.status,
                        borrow_requests.points_cost
                    FROM borrow_requests
                    WHERE borrow_requests.id = ?
                    FOR UPDATE
                `,
                [requestId]
            );

            const request = requests[0];

            if (!request) {
                throw new Error("Request not found.");
            }

            if (Number(request.lender_id) !== Number(req.currentUser.id)) {
                throw new Error("Only the lender can confirm the return.");
            }

            if (request.status !== "Borrowed") {
                throw new Error("Only borrowed items can be marked as returned.");
            }

            await connection.execute(
                "UPDATE users SET points = points + ? WHERE id = ?",
                [request.points_cost + lenderBonus, request.lender_id]
            );

            await connection.execute(
                "UPDATE users SET points = points + ? WHERE id = ?",
                [borrowerReward, request.borrower_id]
            );

            await connection.execute(
                "UPDATE borrow_requests SET status = ?, return_condition = ?, return_notes = ? WHERE id = ?",
                ["Returned", "Good", "Returned in good condition", request.id]
            );

            await connection.execute(
                "UPDATE items SET status = ? WHERE id = ?",
                ["Available", request.item_id]
            );
        });

        res.redirect("/requests?success=Return confirmed and points awarded");
    } catch (err) {
        console.error("Error confirming return:", err);
        res.redirect(`/requests?error=${encodeURIComponent(err.message)}`);
    }
});

module.exports = router;
