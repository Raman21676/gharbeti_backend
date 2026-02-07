# GharBeti Backend API

Node.js/Express backend for the GharBeti rental marketplace app.

## Features

- **Authentication**: Phone-based OTP authentication with JWT
- **Post Management**: CRUD operations for rental listings with image uploads
- **Real-time Chat**: Socket.io-based messaging system
- **Post Status Management**: Active, Pending, Dealed, Expired states
- **Auto-cleanup**: Cron jobs for managing post lifespans
- **Cloudinary Integration**: Image storage and optimization

## Tech Stack

- Node.js 18+
- Express.js
- MongoDB with Mongoose
- Socket.io
- Cloudinary
- JWT Authentication
- Twilio (for SMS OTP)

## Project Structure

```
backend/
├── src/
│   ├── config/          # Database and service configs
│   ├── controllers/     # Route handlers
│   ├── middleware/      # Auth, error handling
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API routes
│   ├── utils/           # Socket.io, helpers
│   └── server.js        # Entry point
├── cron/                # Scheduled jobs
├── .env                 # Environment variables
└── package.json
```

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Run the server**:
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

4. **Run cron jobs** (separate process):
   ```bash
   npm run cron
   ```

## Environment Variables

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
```

## API Endpoints

### Auth
- `POST /api/auth/send-otp` - Send OTP to phone
- `POST /api/auth/verify-otp` - Verify OTP and login
- `POST /api/auth/complete-profile` - Complete user profile
- `GET /api/auth/me` - Get current user

### Posts
- `GET /api/posts` - Get all posts (with filters)
- `POST /api/posts` - Create new post
- `GET /api/posts/:id` - Get single post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/save` - Toggle save post

### Chat
- `GET /api/chat` - Get user's chats
- `POST /api/chat` - Create/get chat for post
- `POST /api/chat/:id/messages` - Send message

## Post Status Lifecycle

1. **active** - Default when posted (15 days lifespan)
2. **pending** - When negotiation starts
3. **dealed** - When rental is confirmed
4. **expired** - Auto after 15 days
5. **deleted** - User deletion

## Cron Jobs

- **Hourly**: Delete dealed posts older than 48 hours
- **Daily 00:00**: Mark expired posts
- **Daily 01:00**: Delete old expired posts (7+ days)

## Socket Events

**Client -> Server**:
- `join_chat` - Join a chat room
- `send_message` - Send a message
- `typing` - Typing indicator

**Server -> Client**:
- `new_message` - New message received
- `typing` - Other user typing
- `notification` - Push notification
