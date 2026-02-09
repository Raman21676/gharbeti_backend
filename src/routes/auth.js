const express = require('express');
const router = express.Router();
const { protect, uploadProfileImage } = require('../middleware/auth');
const {
  sendOTP,
  verifyOTP,
  resendOTP,
  completeProfile,
  getMe,
  updateProfile,
  logout,
} = require('../controllers/authController');

// Public routes
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

// Protected routes
router.get('/me', protect, getMe);
router.post('/resend-otp', protect, resendOTP);
router.post('/complete-profile', protect, completeProfile);
router.put('/profile', protect, uploadProfileImage, updateProfile);
router.post('/logout', protect, logout);

module.exports = router;
