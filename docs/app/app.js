// Import express.js
const express = require("express");
const path = require("path");

// Create express app
var app = express();

// Set Pug as the view engine
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// Add static files location
app.use(express.static(path.join(__dirname, "../static")));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Get the functions in the db.js file to use
const db = require("./services/db");

function parseCookies(cookieHeader) {
    if (!cookieHeader) {
        return {};
    }

    return cookieHeader.split(";").reduce((cookies, cookie) => {
        const parts = cookie.trim().split("=");
        const name = parts.shift();
        const value = parts.join("=");

        cookies[name] = decodeURIComponent(value || "");
        return cookies;
    }, {});
}

app.use(async function(req, res, next) {
    req.cookies = parseCookies(req.headers.cookie);
    req.currentUser = null;
    res.locals.currentUser = null;

    if (!req.cookies.userId) {
        return next();
    }

    try {
        const users = await db.query(
            "SELECT id, username, email, points, profile_image, is_banned, is_deleted FROM users WHERE id = ?",
            [req.cookies.userId]
        );

        if (users.length > 0 && !users[0].is_banned && !users[0].is_deleted) {
            req.currentUser = users[0];
            res.locals.currentUser = users[0];
            res.locals.navCounts = {
                messages: 0,
                requests: 0
            };

            const counts = await Promise.all([
                db.query(
                    "SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND status = 'Pending'",
                    [users[0].id]
                ),
                db.query(
                    `
                        SELECT COUNT(*) AS count
                        FROM borrow_requests
                        WHERE lender_id = ?
                        AND status IN ('Requested', 'Borrowed')
                    `,
                    [users[0].id]
                )
            ]);

            res.locals.navCounts.messages = counts[0][0].count;
            res.locals.navCounts.requests = counts[1][0].count;
        }
    } catch (err) {
        console.error("Error loading logged-in user:", err);
    }

    next();
});

// Import users list routes
const usersRoutes = require("./routes/users");

// Use the users list routes
app.use("/", usersRoutes);

// Import user profile routes
const userProfileRoutes = require("./routes/userprofilepage");
app.use("/", userProfileRoutes);

// Import listing routes
const listingRoutes = require("./routes/listing");
app.use("/", listingRoutes);

// Import item details routes
const itemsRoutes = require("./routes/items");
app.use("/items", itemsRoutes);

const requestsRoutes = require("./routes/requests");
app.use("/", requestsRoutes);

const messagesRoutes = require("./routes/messages");
app.use("/", messagesRoutes);

const reportsRoutes = require("./routes/reports");
app.use("/", reportsRoutes);

const ratingsRoutes = require("./routes/ratings");
app.use("/", ratingsRoutes);

const historyRoutes = require("./routes/history");
app.use("/", historyRoutes);

// Create a route for root - /
app.get("/", async function(req, res) {
    if (!req.currentUser) {
        return res.render("home", {
            pageTitle: "DormShare"
        });
    }

    try {
        const activeBorrowing = await db.query(
            `
                SELECT borrow_requests.id, borrow_requests.status, borrow_requests.points_cost,
                       items.title,
                       users.username AS lender_name
                FROM borrow_requests
                JOIN items ON borrow_requests.item_id = items.id
                JOIN users ON borrow_requests.lender_id = users.id
                WHERE borrow_requests.borrower_id = ?
                AND borrow_requests.status IN ('Requested', 'Borrowed')
                ORDER BY borrow_requests.created_at DESC
                LIMIT 4
            `,
            [req.currentUser.id]
        );

        const activeLending = await db.query(
            `
                SELECT borrow_requests.id, borrow_requests.status, borrow_requests.points_cost,
                       items.title,
                       users.username AS borrower_name
                FROM borrow_requests
                JOIN items ON borrow_requests.item_id = items.id
                JOIN users ON borrow_requests.borrower_id = users.id
                WHERE borrow_requests.lender_id = ?
                AND borrow_requests.status IN ('Requested', 'Borrowed')
                ORDER BY borrow_requests.created_at DESC
                LIMIT 4
            `,
            [req.currentUser.id]
        );

        const pendingMessages = await db.query(
            `
                SELECT messages.id, messages.created_at,
                       users.username AS sender_name,
                       items.title AS item_title
                FROM messages
                JOIN users ON messages.sender_id = users.id
                LEFT JOIN items ON messages.item_id = items.id
                WHERE messages.receiver_id = ?
                AND messages.status = 'Pending'
                ORDER BY messages.created_at DESC
                LIMIT 4
            `,
            [req.currentUser.id]
        );

        const stats = await Promise.all([
            db.query(
                "SELECT COUNT(*) AS count FROM items WHERE user_id = ? AND status = 'Available'",
                [req.currentUser.id]
            ),
            db.query(
                `
                    SELECT COUNT(*) AS count
                    FROM borrow_requests
                    WHERE (borrower_id = ? OR lender_id = ?)
                    AND status = 'Returned'
                `,
                [req.currentUser.id, req.currentUser.id]
            )
        ]);

        res.render("dashboard", {
            pageTitle: "Dashboard",
            activeBorrowing,
            activeLending,
            pendingMessages,
            availableListingsCount: stats[0][0].count,
            completedSharesCount: stats[1][0].count
        });
    } catch (err) {
        console.error("Error loading dashboard:", err);
        res.render("home", {
            pageTitle: "DormShare"
        });
    }
});

const authRoutes = require("./routes/auth");
app.use("/", authRoutes);


// Create a route for testing the db
app.get("/db_test", function(req, res) {
    const sql = "select * from test_table";

    db.query(sql).then(results => {
        console.log(results);
        res.send(results);
    }).catch(err => {
        console.log(err);
        res.send("Database error");
    });
});

// Create a route for /goodbye
app.get("/goodbye", function(req, res) {
    res.send("Goodbye world!");
});

// Create a dynamic route for /hello/<name>
app.get("/hello/:name", function(req, res) {
    console.log(req.params);
    res.send("Hello " + req.params.name);
});

// Start server on port 3000
app.listen(3000, function() {
    console.log(`Server running at http://127.0.0.1:3000/`);
});
