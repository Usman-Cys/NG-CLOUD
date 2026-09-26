const express = require('express');
const router = express.Router();
const authVerify = require('../middleware/authVerify');
const policyController = require('../controllers/policyController');

router.get('/upload', authVerify, policyController.getUploadPolicy);

module.exports = router;
