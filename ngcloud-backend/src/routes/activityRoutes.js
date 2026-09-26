const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');
const authVerify = require('../middleware/authVerify');

router.get('/', authVerify, activityController.getActivities);

module.exports = router;
