const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authVerify = require('../middleware/authVerify');

router.get('/search', authVerify, userController.searchUsers);

module.exports = router;
