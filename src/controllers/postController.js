const Post = require('../models/Post');
const User = require('../models/User');

// Get all posts with filters
exports.getPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      minPrice,
      maxPrice,
      city,
      lat,
      lng,
      radius = 5000, // meters
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const query = { status: 'active' };

    // Apply filters
    if (type) query.type = type;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (city) query['location.city'] = { $regex: city, $options: 'i' };

    // Geospatial query
    if (lat && lng) {
      query['location.lat'] = {
        $gte: Number(lat) - 0.1,
        $lte: Number(lat) + 0.1,
      };
      query['location.lng'] = {
        $gte: Number(lng) - 0.1,
        $lte: Number(lng) + 0.1,
      };
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'asc' ? 1 : -1;

    const posts = await Post.find(query)
      .populate('owner', 'name phone profileImage')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Post.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        posts,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single post
exports.getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('owner', 'name phone profileImage createdAt');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Increment views
    post.views += 1;
    await post.save();

    res.status(200).json({
      success: true,
      data: { post },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create post
exports.createPost = async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      type,
      location,
      amenities,
      specifications,
      contactInfo,
    } = req.body;

    // Get image URLs from Cloudinary
    const images = req.files ? req.files.map((file) => file.path) : [];

    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required',
      });
    }

    const post = await Post.create({
      owner: req.user.id,
      title,
      description,
      price: Number(price),
      type,
      location: JSON.parse(location),
      images,
      amenities: amenities ? JSON.parse(amenities) : [],
      specifications: specifications ? JSON.parse(specifications) : {},
      contactInfo: contactInfo ? JSON.parse(contactInfo) : {},
    });

    await post.populate('owner', 'name phone profileImage');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: { post },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update post
exports.updatePost = async (req, res) => {
  try {
    let post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check ownership
    if (post.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this post',
      });
    }

    const updateData = { ...req.body };

    // Parse JSON fields
    if (updateData.location) updateData.location = JSON.parse(updateData.location);
    if (updateData.amenities) updateData.amenities = JSON.parse(updateData.amenities);
    if (updateData.specifications) updateData.specifications = JSON.parse(updateData.specifications);
    if (updateData.contactInfo) updateData.contactInfo = JSON.parse(updateData.contactInfo);

    // Handle new images
    if (req.files && req.files.length > 0) {
      updateData.images = req.files.map((file) => file.path);
    }

    post = await Post.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate('owner', 'name phone profileImage');

    res.status(200).json({
      success: true,
      message: 'Post updated successfully',
      data: { post },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete post
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check ownership
    if (post.owner.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post',
      });
    }

    post.status = 'deleted';
    await post.save();

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get user's posts
exports.getMyPosts = async (req, res) => {
  try {
    const { status } = req.query;

    const query = { owner: req.user.id };
    if (status) query.status = status;

    const posts = await Post.find(query).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { posts },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Renew post
exports.renewPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check ownership
    if (post.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to renew this post',
      });
    }

    await post.renew();

    res.status(200).json({
      success: true,
      message: 'Post renewed successfully',
      data: { post },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Mark post as dealed
exports.markAsDealed = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Check ownership
    if (post.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this post',
      });
    }

    await post.markAsDealed();

    res.status(200).json({
      success: true,
      message: 'Post marked as dealed',
      data: { post },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Toggle save post
exports.toggleSavePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const user = await User.findById(req.user.id);
    const isSaved = user.savedPosts.includes(post._id);

    if (isSaved) {
      user.savedPosts.pull(post._id);
      post.favoritesCount -= 1;
    } else {
      user.savedPosts.push(post._id);
      post.favoritesCount += 1;
    }

    await user.save();
    await post.save();

    res.status(200).json({
      success: true,
      message: isSaved ? 'Post unsaved' : 'Post saved',
      data: { isSaved: !isSaved },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get saved posts
exports.getSavedPosts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'savedPosts',
      populate: { path: 'owner', select: 'name phone profileImage' },
    });

    res.status(200).json({
      success: true,
      data: { posts: user.savedPosts },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Report post
exports.reportPost = async (req, res) => {
  try {
    const { reason } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    post.reports.push({
      reason,
      reportedBy: req.user.id,
    });
    post.isReported = true;
    await post.save();

    res.status(200).json({
      success: true,
      message: 'Post reported successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
