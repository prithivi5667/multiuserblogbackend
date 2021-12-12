const Category = require('../models/category');
const Blog = require('../models/blog');
const slugify = require('slugify');
const { errorHandler } = require('../helpers/dbErrorHandler');
const { response, request } = require('express');

exports.create = (req, res) => {
  const { name } = req.body;
  let slug = slugify(name).toLowerCase();
  let category = new Category({ name, slug });
  category.save((error, data) => {
    if (error) {
      return res.status(400).json({ error: errorHandler(error) });
    }
    res.json(data);
  });
};

exports.list = (req, res = response) => {
  Category.find().exec((error, categories) => {
    if (error) {
      return res.status(400).json({ error: errorHandler(error) });
    }
    res.json(categories);
  });
};

exports.read = async (req = request, res = response) => {
  const slug = req.params.slug.toLowerCase();
  try {
    const findCategory = await Category.findOne({ slug });
    const blogs = await Blog.find({ categories: findCategory })
      .populate('categories', '_id name slug')
      .populate('tags', '_id name slug')
      .populate('postedBy', '_id name ')
      .select('_id title slug excerpt categories postedBy tags createdAt updatedAt');
    return res.json({ category: findCategory, blogs });
  } catch (error) {
    return res.status(400).json({ error: errorHandler(error) });
  }
};

exports.remove = (req = request, res = response) => {
  const slug = req.params.slug.toLowerCase();
  Category.findOneAndRemove({ slug }).exec((error) => {
    if (error) {
      return res.status(400).json({ error: errorHandler(error) });
    }
    res.json({ message: 'Category deleted successfully' });
  });
};
