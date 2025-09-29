import User from '../models/User.js';

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, location, bio, profileImage } = req.body;
    const userId = req.user.userId;

    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (location) updateData.location = location;
    if (bio) updateData.bio = bio;
    if (profileImage) updateData.profileImage = profileImage;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Convert arrays into key-value pairs
    const convertToKeyValue = (arr) =>
      Array.isArray(arr) ? arr.map((item, index) => ({ key: index, value: item })) : arr;

    const userObj = updatedUser.toJSON();
    userObj.skintype = convertToKeyValue(userObj.skintype);
    userObj.skinConcerns = convertToKeyValue(userObj.skinConcerns);
    userObj.lifestyle = convertToKeyValue(userObj.lifestyle);
    userObj.skinCondition = convertToKeyValue(userObj.skinCondition);
    userObj.medication = convertToKeyValue(userObj.medication);
    userObj.skinGoals = convertToKeyValue(userObj.skinGoals);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: userObj }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


// Update notification preferences
export const updateNotificationPreferences = async (req, res) => {
  try {
    const { notificationsEnabled, deviceToken } = req.body;
    const userId = req.user.userId;

    // Build update object
    const updateData = { notificationsEnabled,deviceToken };

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: {
        notificationsEnabled: user.notificationsEnabled,
        deviceToken: user.deviceToken
      }
    });

  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};


// Delete user account
export const deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
