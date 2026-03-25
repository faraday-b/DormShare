const express = require('express');
const router = express.Router();

// This moves up one level from 'routes' and into 'services' to find your db connection
const { db } = require('../services/db'); 

// User profile route: /user/:id/profile
router.get("/user/:id/profile", function(req, res) {
    var userId = req.params.id; 

    // Querying your Users table for the specific ID
    var sql = 'SELECT id, username, points FROM Users WHERE id = ?';

    db.query(sql, [userId]).then(results => {
        if (results.length > 0) {
            // Render the 'profile.pug' template with the database results
            res.render('profile', { 
                pageTitle: results[0].username + ' - DormShare', 
                data: results[0] 
            });
        } else {
            res.status(404).send("User not found in our system.");
        }
    }).catch(err => {
        console.error("Database error:", err);
        res.status(500).send("Internal Server Error");
    });
});

module.exports = router;