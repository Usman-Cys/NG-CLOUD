const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const authVerify = require('../middleware/authVerify');
const {
  validateCreateShare,
  validateCreateShareBatch,
  validateDeleteShare
} = require('../middleware/requestValidator');

router.get('/shared-by-me', authVerify, shareController.sharedByMe);
router.get('/shared-with-me', authVerify, shareController.sharedWithMe);
router.post('/', authVerify, validateCreateShare, shareController.createShare);
router.post('/batch', authVerify, validateCreateShareBatch, shareController.createShareBatch);
router.delete('/:shareId', authVerify, validateDeleteShare, shareController.deleteShare);

module.exports = router;
