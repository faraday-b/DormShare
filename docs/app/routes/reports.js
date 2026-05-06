const express = require("express");
const router = express.Router();
const db = require("../services/db");

const BAN_REPORT_LIMIT = 3;

function requireLogin(req, res, next) {
    if (!req.currentUser) {
        return res.redirect("/login");
    }

    next();
}

router.post("/items/:id/report", requireLogin, async function(req, res) {
    const itemId = req.params.id;
    const reason = (req.body.reason || "").trim();

    try {
        if (!reason) {
            throw new Error("Please explain why you are reporting this item.");
        }

        await db.transaction(async (connection) => {
            const [items] = await connection.execute(
                "SELECT id, user_id FROM items WHERE id = ?",
                [itemId]
            );

            if (items.length === 0) {
                throw new Error("Item not found.");
            }

            const item = items[0];

            if (Number(item.user_id) === Number(req.currentUser.id)) {
                throw new Error("You cannot report your own listing.");
            }

            await connection.execute(
                `
                    INSERT INTO reports (reporter_id, reported_user_id, item_id, reason, status)
                    VALUES (?, ?, ?, ?, ?)
                `,
                [req.currentUser.id, item.user_id, item.id, reason, "Open"]
            );

            await connection.execute(
                "UPDATE users SET report_count = report_count + 1 WHERE id = ?",
                [item.user_id]
            );

            await connection.execute(
                "UPDATE users SET is_banned = 1 WHERE id = ? AND report_count >= ?",
                [item.user_id, BAN_REPORT_LIMIT]
            );
        });

        res.redirect(`/items/${itemId}?success=Report submitted`);
    } catch (err) {
        console.error("Error submitting report:", err);
        res.redirect(`/items/${itemId}?error=${encodeURIComponent(err.message)}`);
    }
});

router.post("/user/:id/report", requireLogin, async function(req, res) {
    const reportedUserId = req.params.id;
    const reason = (req.body.reason || "").trim();

    try {
        if (Number(reportedUserId) === Number(req.currentUser.id)) {
            throw new Error("You cannot report yourself.");
        }

        if (!reason) {
            throw new Error("Please explain why you are reporting this user.");
        }

        await db.transaction(async (connection) => {
            const [users] = await connection.execute(
                "SELECT id FROM users WHERE id = ?",
                [reportedUserId]
            );

            if (users.length === 0) {
                throw new Error("User not found.");
            }

            await connection.execute(
                `
                    INSERT INTO reports (reporter_id, reported_user_id, item_id, reason, status)
                    VALUES (?, ?, NULL, ?, ?)
                `,
                [req.currentUser.id, reportedUserId, reason, "Open"]
            );

            await connection.execute(
                "UPDATE users SET report_count = report_count + 1 WHERE id = ?",
                [reportedUserId]
            );

            await connection.execute(
                "UPDATE users SET is_banned = 1 WHERE id = ? AND report_count >= ?",
                [reportedUserId, BAN_REPORT_LIMIT]
            );
        });

        res.redirect(`/user/${reportedUserId}/profile?reported=true`);
    } catch (err) {
        console.error("Error reporting user:", err);
        res.redirect(`/user/${reportedUserId}/profile?reportError=${encodeURIComponent(err.message)}`);
    }
});

router.get("/reports", requireLogin, async function(req, res) {
    try {
        const reports = await db.query(
            `
                SELECT reports.id, reports.reason, reports.status, reports.created_at,
                       reporter.username AS reporter_name,
                       reported.username AS reported_name,
                       reported.report_count,
                       reported.is_banned,
                       items.title AS item_title
                FROM reports
                JOIN users AS reporter ON reports.reporter_id = reporter.id
                JOIN users AS reported ON reports.reported_user_id = reported.id
                LEFT JOIN items ON reports.item_id = items.id
                WHERE reports.reporter_id = ? OR reports.reported_user_id = ?
                ORDER BY reports.created_at DESC
            `,
            [req.currentUser.id, req.currentUser.id]
        );

        res.render("reports", {
            pageTitle: "Reports",
            reports
        });
    } catch (err) {
        console.error("Error loading reports:", err);
        res.status(500).send("Could not load reports.");
    }
});

module.exports = router;
