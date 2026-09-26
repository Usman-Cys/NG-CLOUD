const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authVerify = require('../middleware/authVerify');
const { validateRegister, validateLogin, validateSavePublicKey } = require('../middleware/requestValidator');

router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/logout', authVerify, authController.logout);
router.get('/me', authVerify, authController.me);
router.post('/kyber-public-key', authVerify, validateSavePublicKey, authController.saveKyberPublicKey);

module.exports = router;
