// Import express.js
const express = require("express");
const path = require("path");

// Create express app
var app = express();

// Add static files location
app.use(express.static(path.join(__dirname, "../static")));
app.use(express.urlencoded({ extended: true }));

// Set Pug
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// Get the functions in the db.js file to use
const db = require('./services/db');

// Import listing routes
const listingRoutes = require("./routes/listing");
app.use("/", listingRoutes);

// Create a route for root - /
app.get("/", function(req, res) {
    res.redirect("/listings");
});

// Create a route for testing the db
app.get("/db_test", function(req, res) {
    sql = 'select * from test_table';
    db.query(sql).then(results => {
        console.log(results);
        res.send(results)
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
app.listen(3000,function(){
    console.log(`Server running at http://127.0.0.1:3000/`);
});