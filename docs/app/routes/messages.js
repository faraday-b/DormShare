const express = require("express");
const router = express.Router();
const db = require("../services/db");

// Temporary logged-in user until login is added
const CURRENT_USER_ID = 1;

// Inbox page
router.get("/", async function (req, res) {
    try {
        const sql = `
            SELECT 
                messages.id,
                messages.message_text,
                messages.sent_at,
                sender.username AS sender_name,
                receiver.username AS receiver_name,
                items.title AS item_title
            FROM messages
            JOIN users AS sender ON messages.sender_id = sender.id
            JOIN users AS receiver ON messages.receiver_id = receiver.id
            LEFT JOIN items ON messages.item_id = items.id
            WHERE messages.receiver_id = ?
            ORDER BY messages.sent_at DESC
        `;

        const messages = await db.query(sql, [CURRENT_USER_ID]);

        res.render("messages", {
            pageTitle: "My Messages",
            messages: messages
        });

    } catch (err) {
        console.error("Error loading messages:", err);
        res.status(500).send("Error loading messages");
    }
});

// Show message form for an item
router.get("/new/:itemId", async function (req, res) {
    try {
        const itemId = req.params.itemId;

        const sql = `
            SELECT 
                items.id,
                items.title,
                items.user_id AS owner_id,
                users.username AS owner_name
            FROM items
            JOIN users ON items.user_id = users.id
            WHERE items.id = ?
        `;

        const results = await db.query(sql, [itemId]);

        if (results.length === 0) {
            return res.status(404).send("Item not found");
        }

        res.render("message-form", {
            pageTitle: "Message Owner",
            item: results[0]
        });

    } catch (err) {
        console.error("Error loading message form:", err);
        res.status(500).send("Error loading message form");
    }
});

// Send message
router.post("/send/:itemId", async function (req, res) {
    try {
        const itemId = req.params.itemId;
        const messageText = req.body.messageText;

        const itemSql = "SELECT user_id FROM items WHERE id = ?";
        const itemResults = await db.query(itemSql, [itemId]);

        if (itemResults.length === 0) {
            return res.status(404).send("Item not found");
        }

        const receiverId = itemResults[0].user_id;

        const insertSql = `
            INSERT INTO messages (sender_id, receiver_id, item_id, message_text)
            VALUES (?, ?, ?, ?)
        `;

        await db.query(insertSql, [
            CURRENT_USER_ID,
            receiverId,
            itemId,
            messageText
        ]);

        res.redirect("/messages");

    } catch (err) {
        console.error("Error sending message:", err);
        res.status(500).send("Error sending message");
    }
});

module.exports = router;