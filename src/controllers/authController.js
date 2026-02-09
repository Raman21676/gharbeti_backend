const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Send email OTP
const sendEmailOTP = async (email, otp) => {
  const transporter = createTransporter();
  const fromName = process.env.SMTP_FROM_NAME || 'GharBeti';
  
  const mailOptions = {
    from: `"${fromName}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Your GharBeti Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #4CAF50; text-align: center;">GharBeti</h2>
        <h3 style="color: #333;">Your Verification Code</h3>
        <p style="color: #666; font-size: 16px;">Use the following OTP to complete your login:</p>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #333; letter-spacing: 8px;">${otp}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This code will expire in <strong>10 minutes</strong>.</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
        <p style="color: #999; font-size: 12px; text-align: center;">GharBeti - Find Your Perfect Home in Nepal</p>
      </div>
    `,
    text: `Your GharBeti verification code is: ${otp}. This code will expire in 10 minutes.`,
  };

  await transporter.sendMail(mailOptions);
};

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format',
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Find or create user
    let user = await User.findOne({ email });

    if (!user) {
      // New user - create with minimal info
      user = await User.create({
        email,
        name: 'User', // Will be updated in profile setup
        otp: {
          code: otp,
          expiresAt: otpExpires,
        },
      });
    } else {
      // Existing user - update OTP
      user.otp = {
        code: otp,
        expiresAt: otpExpires,
      };
      await user.save();
    }

    // Send OTP via email
    try {
      await sendEmailOTP(email, otp);
      console.log(`OTP sent to ${email}: ${otp}`);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      // For development, still return success with OTP
      console.log(`[DEV] OTP for ${email}: ${otp}`);
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your email',
      data: {
        email,
        // Only for development
        ...(process.env.NODE_ENV === 'development' && { otp }),
        isNewUser: !user.name || user.name === 'User',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Resend OTP for email verification
exports.resendOTP = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = {
      code: otp,
      expiresAt: otpExpires,
    };
    await user.save();

    // Send OTP via email
    try {
      await sendEmailOTP(user.email, otp);
      console.log(`OTP resent to ${user.email}: ${otp}`);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      console.log(`[DEV] OTP for ${user.email}: ${otp}`);
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your email',
      data: {
        email: user.email,
        ...(process.env.NODE_ENV === 'development' && { otp }),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email address and OTP are required',
      });
    }

    const user = await User.findOne({ email }).select('+otp');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check OTP
    if (!user.otp || user.otp.code !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    // Check OTP expiry
    if (new Date() > user.otp.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired',
      });
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.otp = undefined;
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        token,
        user,
        isProfileComplete: user.name && user.name !== 'User',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Complete Profile
exports.completeProfile = async (req, res) => {
  try {
    const { name, nickname, phone, gender, age, role } = req.body;
    const userId = req.user.id;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    if (!phone || phone.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required',
      });
    }

    // Validate Nepali phone number (10 digits)
    const phoneRegex = /^9[0-9]{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number. Must be a 10-digit Nepali number starting with 9',
      });
    }

    if (!age || age < 18 || age > 120) {
      return res.status(400).json({
        success: false,
        message: 'Age must be between 18 and 120',
      });
    }

    if (gender && !['Male', 'Female', 'Other'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Gender must be Male, Female, or Other',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update fields
    user.name = name.trim();
    if (nickname) user.nickname = nickname.trim();
    user.phone = phone.trim();
    if (gender) user.gender = gender;
    user.age = parseInt(age);
    if (role && ['tenant', 'owner'].includes(role)) user.role = role;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile completed successfully',
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get Current User
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('savedPosts', 'title price images type status location');

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;

    if (req.file) {
      updateData.profileImage = req.file.path;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Logout (optional - mainly for blacklisting tokens)
exports.logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};
