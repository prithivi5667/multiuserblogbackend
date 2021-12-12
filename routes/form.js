const express = require('express');
const router = express.Router();
const { contactBlogAuthorForm } = require('../controllers/form');

// validators
const { contactFormValidator } = require('../validators/form');
const { runValidation } = require('../validators');

router.post('/contact', contactFormValidator, runValidation, contactBlogAuthorForm);
router.post('/contact-blog-author', contactFormValidator, runValidation, contactBlogAuthorForm);

module.exports = router;
