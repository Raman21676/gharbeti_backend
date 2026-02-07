const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chat = require('../models/Chat');

let io;

const initializeSocket = (server) => {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Join user's room for private messages
    socket.join(socket.userId);

    // Join chat rooms
    socket.on('join_chat', (chatId) => {
      socket.join(chatId);
      console.log(`User ${socket.userId} joined chat ${chatId}`);
    });

    // Leave chat room
    socket.on('leave_chat', (chatId) => {
      socket.leave(chatId);
      console.log(`User ${socket.userId} left chat ${chatId}`);
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      socket.to(data.chatId).emit('typing', {
        chatId: data.chatId,
        userId: socket.userId,
      });
    });

    socket.on('stop_typing', (data) => {
      socket.to(data.chatId).emit('stop_typing', {
        chatId: data.chatId,
        userId: socket.userId,
      });
    });

    // Handle new message
    socket.on('send_message', async (data) => {
      try {
        const { chatId, text, type = 'text', imageUrl } = data;

        const chat = await Chat.findById(chatId);
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        // Verify user is participant
        if (!chat.participants.includes(socket.userId)) {
          socket.emit('error', { message: 'Not authorized' });
          return;
        }

        const messageData = {
          sender: socket.userId,
          text,
          type,
          imageUrl,
          createdAt: new Date(),
        };

        chat.messages.push(messageData);
        chat.lastMessage = messageData;
        await chat.save();

        // Get sender info
        const message = chat.messages[chat.messages.length - 1];

        // Emit to all participants in the chat
        const populatedChat = await Chat.findById(chatId)
          .populate('messages.sender', 'name profileImage')
          .populate('participants', 'name phone profileImage');

        const populatedMessage = populatedChat.messages[populatedChat.messages.length - 1];

        io.to(chatId).emit('new_message', {
          chatId,
          message: populatedMessage,
        });

        // Send notification to other participants
        chat.participants.forEach((participantId) => {
          if (participantId.toString() !== socket.userId) {
            io.to(participantId.toString()).emit('notification', {
              type: 'new_message',
              chatId,
              message: populatedMessage,
            });
          }
        });
      } catch (error) {
        console.error('Socket message error:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Handle message read
    socket.on('mark_read', async (data) => {
      try {
        const { chatId } = data;
        const chat = await Chat.findById(chatId);

        if (chat) {
          await chat.markAsRead(socket.userId);
          socket.to(chatId).emit('messages_read', {
            chatId,
            userId: socket.userId,
          });
        }
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIO };
