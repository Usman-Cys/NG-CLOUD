const express = require('express');
const router = express.Router();
const authVerify = require('../middleware/authVerify');
const fileController = require('../controllers/fileController');
const {
  validateUploadUrl,
  validateDownloadUrl,
  validateSaveMetadata,
  validateFileGet,
  validateFileDelete,
  validateFileLock,
  validateFileUnlock,
  validateSaveFileChunks,
  validateFileReview
} = require('../middleware/requestValidator');

router.get('/shared', authVerify, fileController.listShared);
router.post('/upload-url', authVerify, validateUploadUrl, fileController.generateUploadUrl);
router.post('/download-url', authVerify, validateDownloadUrl, fileController.generateDownloadUrl);
router.get('/', authVerify, fileController.listFiles);
router.post('/metadata', authVerify, validateSaveMetadata, fileController.saveMetadata);
router.get('/:fileId', authVerify, validateFileGet, fileController.getFile);
router.delete('/:fileId', authVerify, validateFileDelete, fileController.deleteFile);
router.post('/:fileId/lock', authVerify, validateFileLock, fileController.lockFile);
router.delete('/:fileId/lock', authVerify, validateFileUnlock, fileController.unlockFile);
router.post('/:fileId/chunks', authVerify, validateSaveFileChunks, fileController.saveFileChunks);
router.post('/:fileId/review', authVerify, validateFileReview, fileController.reviewFile);

module.exports = router;
