const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadChatImage } = require('../config/cloudinary');
const {
  getOrCreateChat,
  getMyChats,
  getChat,
  sendMessage,
  proposeDeal,
  respondToDeal,
  deleteChat,
} = require('../controllers/chatController');

// Chat routes
router.get('/', protect, getMyChats);
router.post('/', protect, getOrCreateChat);
router.get('/:id', protect, getChat);
router.post('/:id/messages', protect, uploadChatImage, sendMessage);
router.post('/:id/propose-deal', protect, proposeDeal);
router.post('/:id/respond-deal', protect, respondToDeal);
router.delete('/:id', protect, deleteChat);

module.exports = router;
