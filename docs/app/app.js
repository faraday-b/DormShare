// Import express and path
const express = require("express");
const path = require("path");

// Create express app
var app = express();

// Middleware to handle form data
app.use(express.urlencoded({ extended: true }));

// Serve static files (CSS, images)
app.use(express.static(path.join(__dirname, "../static")));

// Set Pug as the view engine
app.set("view engine", "pug");

// Set views folder location
app.set("views", path.join(__dirname, "views"));

// Import database functions
const db = require("./services/db");

// Import listing routes (from routes folder)
const listingRoutes = require("./routes/listing");

// Use listing routes
app.use("/", listingRoutes);

// Root route (redirect to listings page)
app.get("/", function (req, res) {
    res.redirect("/listings"); // ✅ FIXED (removed res.send)
});

// Database test route
app.get("/db_test", function (req, res) {
    let sql = "SELECT * FROM test_table";

    db.query(sql)
        .then(results => {
            console.log(results);
            res.send(results);
        })
        .catch(err => {
            console.error(err);
            res.send("Database error");
        });
});

// Simple route
app.get("/goodbye", function (req, res) {
    res.send("Goodbye world!");
});

// Dynamic route
app.get("/hello/:name", function (req, res) {
    res.send("Hello " + req.params.name);
});

// Start server
app.listen(3000, function () {
    console.log("Server running at http://127.0.0.1:3000/");
});