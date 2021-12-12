const Blog = require('../models/blog');
const Category = require('../models/category');
const Tag = require('../models/tag');
const User = require('../models/user');
const formidable = require('formidable');
const slugify = require('slugify');
const stripHtml = require('string-strip-html');
const _ = require('lodash');
const { errorHandler } = require('../helpers/dbErrorHandler');
const fs = require('fs');
const { smartTrim } = require('../helpers/blog');

exports.create = (req, res) => {
  let form = new formidable.IncomingForm();
  form.keepExtensions = true;
  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: 'Image could not upload' });
    }
    const { title, body, categories, tags } = fields;

    if (!title || !title.length) {
      return res.status(400).json({
        error: 'title is required',
      });
    }

    if (!body || body.length < 200) {
      return res.status(400).json({
        error: 'Content is too short',
      });
    }

    if (!categories || categories.length === 0) {
      return res.status(400).json({
        error: 'At least one category is required',
      });
    }

    if (!tags || tags.length === 0) {
      return res.status(400).json({
        error: 'At least one tag is required',
      });
    }

    let blog = new Blog();
    blog.title = title;
    blog.body = body;
    blog.excerpt = smartTrim(body, 320, '', '...');
    blog.slug = slugify(title).toLowerCase();
    blog.mtitle = `${title} | ${process.env.APP_NAME}`;
    blog.mdesc = stripHtml(body.substring(0, 160)).result;
    blog.postedBy = req.user._id;

    let arrayOfCategories = categories ? categories.split(',') : [];
    let arrayOfTags = tags ? tags.split(',') : [];
    if (files.photo) {
      if (files.photo.size > 10000000) {
        return res.status(400).json({ error: 'Image should be less then 1mb in size' });
      }
      blog.photo.data = fs.readFileSync(files.photo.path);
      blog.photo.contentType = files.photo.type;
    }
    try {
      const blogDocument = await blog.save();
      const result = await Blog.findByIdAndUpdate(
        blogDocument._id,
        { $push: { categories: arrayOfCategories, tags: arrayOfTags } },
        { new: true },
      );
      await res.json(result);
    } catch (err) {
      res.status(400).json({ error: errorHandler(err) });
    }
  });
};

exports.list = (req, res) => {
  Blog.find()
    .populate('categories', '_id name slug')
    .populate('tags', '_id name slug')
    .populate('postedBy', '_id name username')
    .select('_id title slug excerpt categories tags postedBy createdAt updatedAt')
    .then((data) => res.json(data))
    .catch((err) => res.json({ error: errorHandler(err) }));
};
exports.listAllBlogsCategoriesTags = async (req, res) => {
  let limit = req.body.limit ? parseInt(req.body.limit) : 10;
  let skip = req.body.skip ? parseInt(req.body.skip) : 0;

  try {
    const blogs = await Blog.find()
      .populate('categories', '_id name slug')
      .populate('tags', '_id name slug')
      .populate('postedBy', '_id name username profile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('_id title slug excerpt categories tags postedBy createdAt updatedAt');
    const categories = await Category.find();
    const tags = await Tag.find();
    return res.json({ blogs, categories, tags, size: blogs.length });
  } catch (error) {
    return res.status(400).json({ error: errorHandler(error) });
  }
};

exports.read = async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  try {
    const blog = await Blog.findOne({ slug })
      .populate('categories', '_id name slug')
      .populate('tags', '_id name slug')
      .populate('postedBy', '_id name username profile')
      .select('_id title body slug mtitle mdesc categories tags postedBy createdAt updatedAt');
    return res.json(blog);
  } catch (error) {
    return res.status(400).json({ error: errorHandler(error) });
  }
};
exports.remove = async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  try {
    await Blog.findOneAndRemove({ slug });
    return res.json({ message: 'Blog deleted sucessfully' });
  } catch (error) {
    return res.status(400).json({ error: errorHandler(error) });
  }
};

exports.update = (req, res) => {
  const slug = req.params.slug.toLowerCase();

  Blog.findOne({ slug }).exec((err, oldBlog) => {
    if (err) {
      return res.status(400).json({
        error: errorHandler(err),
      });
    }

    let form = new formidable.IncomingForm();
    form.keepExtensions = true;

    form.parse(req, (err, fields, files) => {
      if (err) {
        return res.status(400).json({
          error: 'Image could not upload',
        });
      }

      let slugBeforeMerge = oldBlog.slug;
      oldBlog = _.merge(oldBlog, fields);
      oldBlog.slug = slugBeforeMerge;

      const { body, desc, categories, tags } = fields;

      if (body) {
        oldBlog.excerpt = smartTrim(body, 320, ' ', ' ...');
        oldBlog.desc = stripHtml(body.substring(0, 160));
      }

      if (categories) {
        oldBlog.categories = categories.split(',');
      }

      if (tags) {
        oldBlog.tags = tags.split(',');
      }

      if (files.photo) {
        if (files.photo.size > 10000000) {
          return res.status(400).json({
            error: 'Image should be less then 1mb in size',
          });
        }
        oldBlog.photo.data = fs.readFileSync(files.photo.path);
        oldBlog.photo.contentType = files.photo.type;
      }

      oldBlog.save((err, result) => {
        if (err) {
          return res.status(400).json({
            error: errorHandler(err),
          });
        }
        res.json(result);
      });
    });
  });
};

exports.photo = async (req, res) => {
  const slug = req.params.slug.toLowerCase();
  try {
    const blog = await Blog.findOne({ slug }).select('photo');
    if (!blog) throw new Error({ message: 'Blog not found ' });
    res.set('Content-Type', blog.photo.contentType);
    return res.send(blog.photo.data);
  } catch (error) {
    return res.status(400).json({ error: errorHandler(error) });
  }
};

exports.listRelated = async (req, res) => {
  const limit = req.body.limit ? parseint(req.body.limit) : 3;
  const { _id, categories } = req.body.blog;
  try {
    const blogs = await Blog.find({ _id: { $ne: _id }, categories: { $in: categories } })
      .limit(limit)
      .populate('postedBy', '_id name username profile')
      .select('title slug excerpt postedBy createdAt updatedAt');
    return await res.json(blogs);
  } catch (error) {
    return res.status(400).json({ error: 'Blogs not found' });
  }
};

exports.listSearch = async (req, res) => {
  const { search } = req.query;
  try {
    if (!search) {
      error = new Error('A search query is needed to find the blogs');
      error.statusCode = 404;
      throw error;
    }
    const blogs = await Blog.find({
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } },
      ],
    }).select('-photo -body');
    return res.json(blogs);
  } catch (error) {
    const { message } = error;
    const status = error.statusCode || 500;
    return res.status(status).json({ error: message });
  }
};

exports.listByUser = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    const blogs = await Blog.find({ postedBy: user._id })
      .populate('categories', '_id name slug')
      .populate('tags', '_id name slug')
      .populate('postedBy', '_id name username')
      .select('_id title slug postedBy createdAt updatedAt');
    return res.json(blogs);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
