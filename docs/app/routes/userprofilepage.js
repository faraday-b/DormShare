const express = require('express');
const router = express.Router();

const db = require('../services/db'); 

// User profile route: /user/:id/profile
router.get("/user/:id/profile", function(req, res) {
    var userId = req.params.id; 

    // Querying your Users table for the specific ID
    var sql = 'SELECT id, username, points FROM Users WHERE id = ?';

    // Ensure db exists before calling .query()
    if (!db || typeof db.query !== 'function') {
        console.error("Database connection 'db' is not initialized correctly.");
        return res.status(500).send("Database configuration error.");
    }

    db.query(sql, [userId]).then(results => {
        if (results && results.length > 0) {
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