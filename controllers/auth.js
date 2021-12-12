const User = require('../models/user');
const shortId = require('shortid');
const jwt = require('jsonwebtoken');
const expressJwt = require('express-jwt');
const { response } = require('express');
const Blog = require('../models/blog');
const { OAuth2Client } = require('google-auth-library');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const _ = require('lodash');
const shortid = require('shortid');

exports.preSignup = async (req, res, next) => {
  const { name, email, password } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      error = new Error('Email is taken');
      error.statusCode = 400;
      throw error;
    }
    const token = jwt.sign({ name, email, password }, process.env.JWT_SECRET_ACCOUNT_ACTIVATION, {
      expiresIn: '10m',
    });
    const emailData = {
      from: 'prithivi5667@gmail.com',
      to: email,
      subject: `Account activation link`,
      html: `
              <h4>Please use the following link to activate your account:</h4>
              <p>${process.env.CLIENT_URL}/auth/account/activate/${token}</p>
              <hr/>
              <p>This email may contain sensetive information</p>
              <p>https://seoblog.luistest.xyz</p>
            `,
    };
    await sgMail.send(emailData);
    return res.json({
      message: `Email has been sent to ${email}. Follow the instructions to activate your account`,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
};

exports.signup = async (req, res, next) => {
  const token = req.body.token;
  if (!token) return res.json({ error: 'Something went wrong. Try again' });

  jwt.verify(token, process.env.JWT_SECRET_ACCOUNT_ACTIVATION, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Expired link. Signup again' });
    }
    const { name, email, password } = jwt.decode(token);
    let username = shortId.generate();
    let profile = `${process.env.CLIENT_URL}/profile/${username}`;
    const user = new User({ name, email, password, profile, username });
    user
      .save()
      .then(() => res.json({ message: 'Signup success!' }))
      .catch((err) => res.status(401).json({ error: err }));
  });
};

exports.signin = (req, res) => {
  const { email, password } = req.body;
  // check if user exists
  User.findOne({ email }).exec((err, user) => {
    if (err || !user) {
      return res.status(400).json({
        error: 'User with that email does not exist. Please signup',
      });
    }
    // authenticate
    if (!user.authenticate(password)) {
      return res.status(400).json({ error: 'Email and password do not match' });
    }
    // generate a jsonwebtoken and send this to client
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '1d',
    });
    res.cookie('token', token, { expiresIn: '1d' });
    const { _id, username, name, email, role } = user;
    return res.json({ token, user: { _id, username, name, email, role } });
  });
};

exports.signout = (req, res = response) => {
  res.clearCookie('token');
  res.json({ message: 'Signout success' });
};

// exports.requireSignin = expressJwt({
//   secret: process.env.JWT_SECRET,
//   algorithms: ['HS256'],
// });
exports.requireSignin = expressJwt({
  secret: process.env.JWT_SECRET,
  algorithms: ["HS256"], // added later
  userProperty: "auth",
});
exports.authMiddleware = async (req, res, next) => {
  const authUserId = req.user._id;
  try {
    const user = await User.findById({ _id: authUserId });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }
    req.profile = user;
  } catch (error) {
    throw new Error(error);
  }
  next();
};

exports.adminMiddleware = (req, res, next) => {
  const authUserId = req.user._id;
  User.findById({ _id: authUserId }).exec((err, user) => {
    if (err || !user) {
      return res.status(400).json({ error: 'User not found' });
    }
    if (user.role !== 1) {
      return res.status(400).json({ error: 'Admin resource. Access denied' });
    }
    req.profile = user;
    next();
  });
};

exports.canUpdateDeleteBlog = async (req, res, next) => {
  const slug = req.params.slug.toLowerCase();
  try {
    const blog = await Blog.findOne({ slug });
    const authorizedUser = blog.postedBy._id.toString() === req.profile._id.toString();
    if (!authorizedUser) {
      return res.status(400).json({ error: 'You are not authorized' });
    }
    next();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      error = new Error('User with that email does not exist');
      error.statusCode = 401;
      throw error;
    }
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET_RESET_PASSWORD, {
      expiresIn: '10m',
    });
    const emailData = {
      from: 'noreply@seoblog.luistest.xyz',
      to: email,
      subject: `Password reset link`,
      html: `
              <h4>Please use the following link to reset your password:</h4>
              <p>${process.env.CLIENT_URL}/auth/password/reset/${token}</p>
              <hr/>
              <p>This email may contain sensetive information</p>
              <p>https://seoblog.luistest.xyz</p>
            `,
    };
    await user.updateOne({ resetPasswordLink: token });
    await sgMail.send(emailData);
    return res.json({
      message: `Email has been sent to ${email}. Follow the instructions to reset your password. Link expires in 10min`,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
};
exports.resetPassword = async (req, res, next) => {
  const { resetPasswordLink, newPassword } = req.body;
  if (!resetPasswordLink) return;
  jwt.verify(resetPasswordLink, process.env.JWT_SECRET_RESET_PASSWORD, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Expired link. Try again' });
    }
    try {
      let user = await User.findOne({ resetPasswordLink });
      if (!user) {
        error = new Error('Something went wrong. Try later');
        error.statusCode = 401;
        throw error;
      }
      const updateFilds = {
        password: newPassword,
        resetPasswordLink: '',
      };
      user = _.extend(user, updateFilds);
      await user.save();
      return res.json({ message: 'Great! Now you can login with your new password' });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }
  });
};

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
exports.googleLogin = async (req, res, next) => {
  const { tokenId } = req.body;
  try {
    const loginTicket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    let { email_verified, name, email, jti } = loginTicket.payload;
    if (!email_verified) {
      return res.status(400).json({ error: 'Google login fails' });
    }
    const userFound = await User.findOne({ email });
    if (!userFound) {
      let { email_verified, name, email, jti } = loginTicket.payload;
      const username = shortid.generate();
      const profile = `${process.env.CLIENT_URL}/profile/${username}`;
      const password = jti;
      const user = new User({ name, email, profile, username, password });
      await user.save();
      const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
      res.cookie('token', token, { expiresIn: '1d' });
      const { _id, role } = user;
      return res.status(201).json({ token, user: { _id, email, name, role, username } });
    }
    const token = jwt.sign({ _id: userFound._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, { expiresIn: '1d' });
    const { _id, role, username } = userFound;
    return res.json({ token, user: { _id, email, name, role, username } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
};
