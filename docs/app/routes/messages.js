const express = require("express");
const router = express.Router();
const db = require("../services/db");

function requireLogin(req, res, next) {
    if (!req.currentUser) {
        return res.redirect("/login");
    }

    next();
}

router.get("/messages", requireLogin, async function(req, res) {
    try {
        const messageRequests = await db.query(
            `
                SELECT messages.id, messages.created_at,
                       users.id AS sender_id, users.username AS sender_name, items.title AS item_title
                FROM messages
                JOIN users ON messages.sender_id = users.id
                LEFT JOIN items ON messages.item_id = items.id
                WHERE messages.receiver_id = ?
                AND messages.status = 'Pending'
                ORDER BY messages.created_at DESC
            `,
            [req.currentUser.id]
        );

        const inbox = await db.query(
            `
                SELECT messages.id, messages.sender_id, messages.receiver_id, messages.item_id,
                       messages.message_text, messages.created_at, messages.status,
                       sender.username AS sender_name,
                       receiver.username AS receiver_name,
                       items.title AS item_title
                FROM messages
                JOIN users AS sender ON messages.sender_id = sender.id
                JOIN users AS receiver ON messages.receiver_id = receiver.id
                LEFT JOIN items ON messages.item_id = items.id
                WHERE (messages.receiver_id = ? OR messages.sender_id = ?)
                AND messages.status = 'Accepted'
                ORDER BY messages.created_at ASC
            `,
            [req.currentUser.id, req.currentUser.id]
        );

        const sent = await db.query(
            `
                SELECT messages.id, messages.message_text, messages.created_at, messages.status,
                       users.id AS receiver_id, users.username AS receiver_name, items.title AS item_title
                FROM messages
                JOIN users ON messages.receiver_id = users.id
                LEFT JOIN items ON messages.item_id = items.id
                WHERE messages.sender_id = ?
                AND messages.status IN ('Pending', 'Declined')
                ORDER BY messages.created_at DESC
            `,
            [req.currentUser.id]
        );

        const conversations = [];
        const conversationMap = {};

        inbox.forEach((message) => {
            const otherUserId = Number(message.sender_id) === Number(req.currentUser.id)
                ? message.receiver_id
                : message.sender_id;
            const otherUserName = Number(message.sender_id) === Number(req.currentUser.id)
                ? message.receiver_name
                : message.sender_name;
            const itemKey = message.item_id || "direct";
            const key = `${otherUserId}-${itemKey}`;

            if (!conversationMap[key]) {
                conversationMap[key] = {
                    otherUserId,
                    otherUserName,
                    itemId: message.item_id || "",
                    itemTitle: message.item_title,
                    messages: []
                };
                conversations.push(conversationMap[key]);
            }

            conversationMap[key].messages.push(message);
        });

        res.render("messages", {
            pageTitle: "Messages",
            messageRequests,
            conversations,
            sent,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (err) {
        console.error("Error loading messages:", err);
        res.status(500).send("Could not load messages.");
    }
});

router.post("/items/:id/message", requireLogin, async function(req, res) {
    const itemId = req.params.id;
    const messageText = (req.body.message_text || "").trim();

    try {
        if (!messageText) {
            throw new Error("Please enter a message.");
        }

        const items = await db.query(
            "SELECT id, user_id FROM items WHERE id = ?",
            [itemId]
        );

        if (items.length === 0) {
            throw new Error("Item not found.");
        }

        const item = items[0];

        if (Number(item.user_id) === Number(req.currentUser.id)) {
            throw new Error("You cannot message yourself about your own item.");
        }

        await db.query(
            `
                INSERT INTO messages (sender_id, receiver_id, item_id, message_text, status)
                VALUES (?, ?, ?, ?, ?)
            `,
            [req.currentUser.id, item.user_id, item.id, messageText, "Pending"]
        );

        res.redirect(`/items/${itemId}?success=Message request sent`);
    } catch (err) {
        console.error("Error sending message:", err);
        res.redirect(`/items/${itemId}?error=${encodeURIComponent(err.message)}`);
    }
});

router.post("/user/:id/message", requireLogin, async function(req, res) {
    const receiverId = req.params.id;
    const messageText = (req.body.message_text || "").trim();

    try {
        if (Number(receiverId) === Number(req.currentUser.id)) {
            throw new Error("You cannot message yourself.");
        }

        if (!messageText) {
            throw new Error("Please enter a message.");
        }

        const users = await db.query(
            "SELECT id FROM users WHERE id = ? AND is_banned = 0",
            [receiverId]
        );

        if (users.length === 0) {
            throw new Error("User not found or banned.");
        }

        const acceptedConversation = await db.query(
            `
                SELECT id
                FROM messages
                WHERE status = 'Accepted'
                AND item_id IS NULL
                AND (
                    (sender_id = ? AND receiver_id = ?)
                    OR
                    (sender_id = ? AND receiver_id = ?)
                )
                LIMIT 1
            `,
            [req.currentUser.id, receiverId, receiverId, req.currentUser.id]
        );

        const messageStatus = acceptedConversation.length > 0 ? "Accepted" : "Pending";

        await db.query(
            `
                INSERT INTO messages (sender_id, receiver_id, item_id, message_text, status)
                VALUES (?, ?, NULL, ?, ?)
            `,
            [req.currentUser.id, receiverId, messageText, messageStatus]
        );

        res.redirect(`/user/${receiverId}/profile?messageSent=true`);
    } catch (err) {
        console.error("Error sending profile message:", err);
        res.redirect(`/user/${receiverId}/profile?messageError=${encodeURIComponent(err.message)}`);
    }
});

router.post("/messages/:id/accept", requireLogin, async function(req, res) {
    try {
        await db.query(
            "UPDATE messages SET status = ? WHERE id = ? AND receiver_id = ? AND status = ?",
            ["Accepted", req.params.id, req.currentUser.id, "Pending"]
        );

        res.redirect("/messages?success=Message request accepted");
    } catch (err) {
        console.error("Error accepting message:", err);
        res.redirect(`/messages?error=${encodeURIComponent("Could not accept message request.")}`);
    }
});

router.post("/messages/:id/decline", requireLogin, async function(req, res) {
    try {
        await db.query(
            "UPDATE messages SET status = ? WHERE id = ? AND receiver_id = ? AND status = ?",
            ["Declined", req.params.id, req.currentUser.id, "Pending"]
        );

        res.redirect("/messages?success=Message request declined");
    } catch (err) {
        console.error("Error declining message:", err);
        res.redirect(`/messages?error=${encodeURIComponent("Could not decline message request.")}`);
    }
});

router.post("/messages/conversation/delete", requireLogin, async function(req, res) {
    const otherUserId = req.body.other_user_id;
    const itemId = req.body.item_id || null;

    try {
        if (!otherUserId) {
            throw new Error("Conversation not found.");
        }

        if (itemId) {
            await db.query(
                `
                    UPDATE messages
                    SET status = 'Deleted'
                    WHERE status = 'Accepted'
                    AND item_id = ?
                    AND (
                        (sender_id = ? AND receiver_id = ?)
                        OR
                        (sender_id = ? AND receiver_id = ?)
                    )
                `,
                [itemId, req.currentUser.id, otherUserId, otherUserId, req.currentUser.id]
            );
        } else {
            await db.query(
                `
                    UPDATE messages
                    SET status = 'Deleted'
                    WHERE status = 'Accepted'
                    AND item_id IS NULL
                    AND (
                        (sender_id = ? AND receiver_id = ?)
                        OR
                        (sender_id = ? AND receiver_id = ?)
                    )
                `,
                [req.currentUser.id, otherUserId, otherUserId, req.currentUser.id]
            );
        }

        res.redirect("/messages?success=Conversation deleted");
    } catch (err) {
        console.error("Error deleting conversation:", err);
        res.redirect(`/messages?error=${encodeURIComponent(err.message)}`);
    }
});

router.post("/messages/:id/delete", requireLogin, async function(req, res) {
    try {
        await db.query(
            `
                UPDATE messages
                SET status = ?
                WHERE id = ?
                AND (receiver_id = ? OR sender_id = ?)
                AND status = ?
            `,
            ["Deleted", req.params.id, req.currentUser.id, req.currentUser.id, "Accepted"]
        );

        res.redirect("/messages?success=Message deleted");
    } catch (err) {
        console.error("Error deleting message:", err);
        res.redirect(`/messages?error=${encodeURIComponent("Could not delete message.")}`);
    }
});

router.post("/messages/:id/reply", requireLogin, async function(req, res) {
    const messageId = req.params.id;
    const replyText = (req.body.reply_text || "").trim();

    try {
        if (!replyText) {
            throw new Error("Please enter a reply.");
        }

        const messages = await db.query(
            `
                SELECT id, sender_id, receiver_id, item_id, status
                FROM messages
                WHERE id = ?
                AND (receiver_id = ? OR sender_id = ?)
                AND status = 'Accepted'
            `,
            [messageId, req.currentUser.id, req.currentUser.id]
        );

        if (messages.length === 0) {
            throw new Error("You can only reply to accepted conversations.");
        }

        const message = messages[0];
        const receiverId = Number(message.sender_id) === Number(req.currentUser.id)
            ? message.receiver_id
            : message.sender_id;

        await db.query(
            `
                INSERT INTO messages (sender_id, receiver_id, item_id, message_text, status)
                VALUES (?, ?, ?, ?, ?)
            `,
            [req.currentUser.id, receiverId, message.item_id, replyText, "Accepted"]
        );

        res.redirect("/messages?success=Reply sent");
    } catch (err) {
        console.error("Error replying to message:", err);
        res.redirect(`/messages?error=${encodeURIComponent(err.message)}`);
    }
});

module.exports = router;
