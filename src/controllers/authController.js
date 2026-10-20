const User = require('../models/User');
const { logAction } = require('../utils/auditLogger');

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // +password is required because the field has select:false
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');

    const isValid = user && (await user.matchPassword(String(password)));

    if (!isValid) {
      // Log failed attempt without exposing whether user exists
      await logAction({
        actor: { name: String(email), role: 'unknown' },
        action: 'login_failed',
        resource: 'auth',
        resourceName: String(email),
        req,
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account is deactivated. Contact an administrator.' });
    }

    // Regenerate session to prevent session fixation attacks
    req.session.regenerate(async (err) => {
      if (err) return res.status(500).json({ error: 'Login failed. Please try again.' });

      req.session.userId = user._id;

      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });

      await logAction({ actor: user, action: 'login', resource: 'auth', resourceName: user.email, req });

      res.json({ message: 'Login successful.', user: user.toSafeObject() });
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'An error occurred during login.' });
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  const user = req.user;
  req.session.destroy(async (err) => {
    if (err) console.error('Session destroy error:', err);
    await logAction({ actor: user, action: 'logout', resource: 'auth', resourceName: user?.email, req });
    res.clearCookie('pd_session');
    res.json({ message: 'Logged out successfully.' });
  });
};

// GET /api/auth/me
exports.me = (req, res) => {
  res.json({ user: req.user });
};

// PUT /api/auth/password
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(String(currentPassword)))) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    user.password = String(newPassword);
    await user.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
};
