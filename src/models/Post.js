const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      default: 'NPR',
    },
    type: {
      type: String,
      enum: ['room', 'apartment', 'house', 'flat', 'studio'],
      required: [true, 'Property type is required'],
    },
    location: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        default: 'Kathmandu',
      },
      district: String,
    },
    images: [
      {
        type: String,
        required: true,
      },
    ],
    amenities: [
      {
        type: String,
      },
    ],
    specifications: {
      bedrooms: {
        type: Number,
        default: 1,
      },
      bathrooms: {
        type: Number,
        default: 1,
      },
      area: {
        type: Number, // in sq ft
      },
      floor: {
        type: Number,
      },
      furnished: {
        type: Boolean,
        default: false,
      },
    },
    contactInfo: {
      phone: String,
      email: String,
      preferredContactTime: String,
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'dealed', 'expired', 'deleted'],
      default: 'active',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: function () {
        return new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days
      },
    },
    dealCompletedAt: {
      type: Date,
    },
    views: {
      type: Number,
      default: 0,
    },
    favoritesCount: {
      type: Number,
      default: 0,
    },
    isReported: {
      type: Boolean,
      default: false,
    },
    reports: [
      {
        reason: String,
        reportedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        reportedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
postSchema.index({ status: 1, expiresAt: 1 });
postSchema.index({ location: '2dsphere' });
postSchema.index({ owner: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ price: 1 });
postSchema.index({ type: 1 });

// Virtual for days remaining
postSchema.virtual('daysRemaining').get(function () {
  const now = new Date();
  const diff = this.expiresAt - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Method to renew post
postSchema.methods.renew = function () {
  this.status = 'active';
  this.expiresAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  return this.save();
};

// Method to mark as dealed
postSchema.methods.markAsDealed = function () {
  this.status = 'dealed';
  this.dealCompletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Post', postSchema);
