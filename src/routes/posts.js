const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { uploadPostImages } = require('../config/cloudinary');
const {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  getMyPosts,
  renewPost,
  markAsDealed,
  toggleSavePost,
  getSavedPosts,
  reportPost,
} = require('../controllers/postController');

// Public routes
router.get('/', optionalAuth, getPosts);
router.get('/saved', protect, getSavedPosts);
router.get('/my-posts', protect, getMyPosts);
router.get('/:id', optionalAuth, getPost);

// Protected routes
router.post('/', protect, uploadPostImages, createPost);
router.put('/:id', protect, uploadPostImages, updatePost);
router.delete('/:id', protect, deletePost);
router.post('/:id/renew', protect, renewPost);
router.post('/:id/deal', protect, markAsDealed);
router.post('/:id/save', protect, toggleSavePost);
router.post('/:id/report', protect, reportPost);

module.exports = router;
