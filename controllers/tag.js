const Tag = require('../models/tag');
const Blog = require('../models/blog');
const slugify = require('slugify');
const { errorHandler } = require('../helpers/dbErrorHandler');
const { response, request } = require('express');

exports.create = (req, res) => {
  const { name } = req.body;
  let slug = slugify(name).toLowerCase();
  let tag = new Tag({ name, slug });
  tag.save((error, data) => {
    if (error) {
      return res.status(400).json({ error: errorHandler(error) });
    }
    res.json(data);
  });
};

exports.list = (req, res = response) => {
  Tag.find().exec((error, tags) => {
    if (error) {
      return res.status(400).json({ error: errorHandler(error) });
    }
    res.json(tags);
  });
};

exports.read = async (req = request, res = response) => {
  const slug = req.params.slug.toLowerCase();
  try {
    const findTag = await Tag.findOne({ slug });
    const blogs = await Blog.find({ tags: findTag })
      .populate('categories', '_id name slug')
      .populate('tags', '_id name slug')
      .populate('postedBy', '_id name ')
      .select('_id title slug excerpt categories postedBy tags createdAt updatedAt');
    console.log({ findTag, blogs });
    return res.json({ tag: findTag, blogs });
  } catch (error) {
    return res.status(400).json({ error: errorHandler(error) });
  }
};

exports.remove = (req = request, res = response) => {
  const slug = req.params.slug.toLowerCase();
  Tag.findOneAndRemove({ slug }).exec((error) => {
    if (error) {
      return res.status(400).json({ error: errorHandler(error) });
    }
    res.json({ message: 'Tag deleted successfully' });
  });
};
