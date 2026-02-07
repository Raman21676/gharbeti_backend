const Chat = require('../models/Chat');
const Post = require('../models/Post');

// Get or create chat
exports.getOrCreateChat = async (req, res) => {
  try {
    const { postId } = req.body;
    const userId = req.user.id;

    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Can't chat with yourself
    if (post.owner.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create chat with yourself',
      });
    }

    // Check if chat already exists
    let chat = await Chat.findOne({
      post: postId,
      participants: { $all: [userId, post.owner] },
    });

    if (!chat) {
      // Create new chat
      chat = await Chat.create({
        post: postId,
        participants: [userId, post.owner],
      });
    }

    await chat.populate('participants', 'name phone profileImage');
    await chat.populate('post', 'title price images status');

    res.status(200).json({
      success: true,
      data: { chat },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get user's chats
exports.getMyChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user.id,
    })
      .populate('participants', 'name phone profileImage')
      .populate('post', 'title price images status')
      .sort({ updatedAt: -1 });

    // Add unread count for each chat
    const chatsWithUnread = chats.map((chat) => ({
      ...chat.toObject(),
      unreadCount: chat.getUnreadCount(req.user.id),
    }));

    res.status(200).json({
      success: true,
      data: { chats: chatsWithUnread },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single chat
exports.getChat = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate('participants', 'name phone profileImage')
      .populate('post', 'title price images status owner');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    // Check if user is participant
    if (!chat.participants.some((p) => p._id.toString() === req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this chat',
      });
    }

    // Mark messages as read
    await chat.markAsRead(req.user.id);

    res.status(200).json({
      success: true,
      data: { chat },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
  try {
    const { text, type = 'text' } = req.body;
    const chatId = req.params.id;

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send messages in this chat',
      });
    }

    const messageData = {
      sender: req.user.id,
      text,
      type,
    };

    if (req.file) {
      messageData.imageUrl = req.file.path;
      messageData.type = 'image';
    }

    chat.messages.push(messageData);
    chat.lastMessage = messageData;

    await chat.save();

    // Populate sender info
    await chat.populate('messages.sender', 'name profileImage');

    const newMessage = chat.messages[chat.messages.length - 1];

    res.status(200).json({
      success: true,
      data: { message: newMessage },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Propose deal
exports.proposeDeal = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    // Only tenant can propose deal
    const post = await Post.findById(chat.post);
    if (post.owner.toString() === req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only tenant can propose a deal',
      });
    }

    chat.dealStatus = 'pending';

    const messageData = {
      sender: req.user.id,
      text: 'I want to rent this property. Do we have a deal?',
      type: 'deal_proposal',
    };

    chat.messages.push(messageData);
    chat.lastMessage = messageData;
    await chat.save();

    // Update post status to pending
    post.status = 'pending';
    await post.save();

    await chat.populate('messages.sender', 'name profileImage');

    res.status(200).json({
      success: true,
      message: 'Deal proposed successfully',
      data: { chat },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Respond to deal
exports.respondToDeal = async (req, res) => {
  try {
    const { accept } = req.body;
    const chat = await Chat.findById(req.params.id);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    // Only owner can respond
    const post = await Post.findById(chat.post);
    if (post.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only owner can respond to deal',
      });
    }

    if (chat.dealStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'No pending deal to respond to',
      });
    }

    chat.dealStatus = accept ? 'accepted' : 'rejected';

    const messageData = {
      sender: req.user.id,
      text: accept
        ? 'Deal accepted! The property is reserved for you.'
        : 'Sorry, the deal is rejected.',
      type: accept ? 'deal_accepted' : 'deal_rejected',
    };

    chat.messages.push(messageData);
    chat.lastMessage = messageData;
    await chat.save();

    // Update post status
    if (accept) {
      await post.markAsDealed();
    } else {
      post.status = 'active';
      await post.save();
    }

    await chat.populate('messages.sender', 'name profileImage');

    res.status(200).json({
      success: true,
      message: accept ? 'Deal accepted' : 'Deal rejected',
      data: { chat },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete chat
exports.deleteChat = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this chat',
      });
    }

    chat.isActive = false;
    await chat.save();

    res.status(200).json({
      success: true,
      message: 'Chat deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
