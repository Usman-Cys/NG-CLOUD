const express = require("express");
const authVerify = require("../middleware/authVerify");
const adminOnly = require("../middleware/adminOnly");
const {
  validateAdminUserQuota,
  validateAdminUserStatus,
  validateAdminUserDelete,
  validateAdminFileDelete
} = require("../middleware/requestValidator");

const {
  getAdminStats,
  getAdminUsers,
  getAdminFiles,
  getAdminStorage,
  getStorageCapacity,
  getAdminSecurity,
  getAdminLogs,
  getAdminPolicy,
  updateUserQuota,
  updateUserStatus,
  deleteUser,
  deleteFile
} = require("../controllers/adminController");

const router = express.Router();

router.use(authVerify);
router.use(adminOnly);

router.get("/stats", getAdminStats);
router.get("/users", getAdminUsers);
router.get("/files", getAdminFiles);
router.get("/storage", getAdminStorage);
router.get("/storage/capacity", getStorageCapacity);
router.get("/security", getAdminSecurity);
router.get("/logs", getAdminLogs);
router.get("/policy", getAdminPolicy);

router.patch("/users/:userId/quota", validateAdminUserQuota, updateUserQuota);
router.patch("/users/:userId/status", validateAdminUserStatus, updateUserStatus);

// Maintain compatibility for delete actions
router.delete("/users/:userId", validateAdminUserDelete, deleteUser);
router.delete("/files/:id", validateAdminFileDelete, deleteFile);

module.exports = router;
