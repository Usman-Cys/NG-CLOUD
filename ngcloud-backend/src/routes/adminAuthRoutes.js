const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');
const { validateLogin, validateRegister } = require('../middleware/requestValidator');

router.post('/login', validateLogin, adminAuthController.login);
router.post('/register', adminAuthMiddleware, validateRegister, adminAuthController.register);
router.get('/admins', adminAuthMiddleware, adminAuthController.listAdmins);
router.patch('/admins/:id/disable', adminAuthMiddleware, adminAuthController.disableAdmin);

module.exports = router;
