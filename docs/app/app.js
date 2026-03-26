// Import express.js
const express = require("express");

// Create express app
var app = express();

// Use the Pug templating engine
app.set("view engine", "pug");
app.set("views", "./app/views");

// Add static files location
app.use(express.static("static"));
app.use(express.urlencoded({ extended: true }));

// Get the functions in the db.js file to use
const db = require("./services/db");

// Import item routes
const itemsRoutes = require("./routes/items");

// Use item routes
app.use("/items", itemsRoutes);

// Create a route for root - /
app.get("/", function (req, res) {
    res.redirect("/items/1");
});

// Create a route for testing the db
app.get("/db_test", function (req, res) {
    let sql = "select * from test_table";
    db.query(sql)
        .then(results => {
            console.log(results);
            res.send(results);
        })
        .catch(err => {
            console.error("Database test failed:", err);
            res.status(500).send("Database test failed");
        });
});

// Create a route for /goodbye
app.get("/goodbye", function (req, res) {
    res.send("Goodbye world!");
});

// Create a dynamic route for /hello/<name>
app.get("/hello/:name", function (req, res) {
    console.log(req.params);
    res.send("Hello " + req.params.name);
});

// Start server on port 3000
app.listen(3000, function () {
    console.log("Server running at http://127.0.0.1:3000/");
});