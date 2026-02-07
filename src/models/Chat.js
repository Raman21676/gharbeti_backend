const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'deal_proposal', 'deal_accepted', 'deal_rejected'],
      default: 'text',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const chatSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    messages: [messageSchema],
    lastMessage: {
      type: messageSchema,
    },
    dealStatus: {
      type: String,
      enum: ['none', 'pending', 'accepted', 'rejected'],
      default: 'none',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
chatSchema.index({ participants: 1 });
chatSchema.index({ post: 1 });
chatSchema.index({ updatedAt: -1 });

// Get unread count for a user
chatSchema.methods.getUnreadCount = function (userId) {
  return this.messages.filter(
    (msg) => msg.sender.toString() !== userId.toString() && !msg.isRead
  ).length;
};

// Mark messages as read for a user
chatSchema.methods.markAsRead = function (userId) {
  this.messages.forEach((msg) => {
    if (msg.sender.toString() !== userId.toString() && !msg.isRead) {
      msg.isRead = true;
      msg.readAt = new Date();
    }
  });
  return this.save();
};

module.exports = mongoose.model('Chat', chatSchema);
