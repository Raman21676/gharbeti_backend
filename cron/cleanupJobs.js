const cron = require('node-cron');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

// Connect to database
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Import models
const Post = require('../src/models/Post');

// Cron Job 1: Delete 'dealed' posts older than 48 hours (runs every hour)
const cleanupDealedPosts = async () => {
  try {
    const cutoffTime = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

    const result = await Post.deleteMany({
      status: 'dealed',
      dealCompletedAt: { $lt: cutoffTime },
    });

    if (result.deletedCount > 0) {
      console.log(`[${new Date().toISOString()}] Deleted ${result.deletedCount} dealed posts older than 48 hours`);
    }
  } catch (error) {
    console.error('Error in cleanupDealedPosts:', error);
  }
};

// Cron Job 2: Mark posts as expired where expiresAt < now (runs daily at midnight)
const markExpiredPosts = async () => {
  try {
    const result = await Post.updateMany(
      {
        status: 'active',
        expiresAt: { $lt: new Date() },
      },
      {
        $set: { status: 'expired' },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[${new Date().toISOString()}] Marked ${result.modifiedCount} posts as expired`);
    }
  } catch (error) {
    console.error('Error in markExpiredPosts:', error);
  }
};

// Cron Job 3: Delete expired posts after 7 days of expiration (runs daily at 1 AM)
const deleteOldExpiredPosts = async () => {
  try {
    const cutoffTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const result = await Post.deleteMany({
      status: 'expired',
      expiresAt: { $lt: cutoffTime },
    });

    if (result.deletedCount > 0) {
      console.log(`[${new Date().toISOString()}] Deleted ${result.deletedCount} expired posts older than 7 days`);
    }
  } catch (error) {
    console.error('Error in deleteOldExpiredPosts:', error);
  }
};

// Initialize cron jobs
const initCronJobs = async () => {
  await connectDB();

  // Run every hour
  cron.schedule('0 * * * *', () => {
    console.log('Running cleanupDealedPosts...');
    cleanupDealedPosts();
  });

  // Run daily at midnight
  cron.schedule('0 0 * * *', () => {
    console.log('Running markExpiredPosts...');
    markExpiredPosts();
  });

  // Run daily at 1 AM
  cron.schedule('0 1 * * *', () => {
    console.log('Running deleteOldExpiredPosts...');
    deleteOldExpiredPosts();
  });

  console.log('Cron jobs initialized');
  console.log('Schedule:');
  console.log('  - cleanupDealedPosts: Every hour');
  console.log('  - markExpiredPosts: Daily at 00:00');
  console.log('  - deleteOldExpiredPosts: Daily at 01:00');
};

// Run immediately if called directly
if (require.main === module) {
  initCronJobs();
}

module.exports = {
  cleanupDealedPosts,
  markExpiredPosts,
  deleteOldExpiredPosts,
};
