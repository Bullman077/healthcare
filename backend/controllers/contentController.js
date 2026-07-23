const { Op } = require('sequelize');
const { Message, Testimonial, Setting, Service } = require('../models');
const { AppError } = require('../middleware/errorHandler');

/* ===== MESSAGES ===== */
exports.submitMessage = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    const msg = await Message.create({ name, email, phone, subject, message });
    res.status(201).json({ success: true, message: 'Thank you! We will get back to you soon.', data: { id: msg.id } });
  } catch (err) {
    next(err);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isRead } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const where = {};
    if (isRead !== undefined) where.isRead = isRead === 'true';

    const { count, rows } = await Message.findAndCountAll({
      where, order: [['createdAt', 'DESC']], offset, limit: parseInt(limit, 10),
    });

    res.json({
      success: true, data: rows,
      pagination: { page: parseInt(page, 10), limit: parseInt(limit, 10), total: count, pages: Math.ceil(count / parseInt(limit, 10)) },
    });
  } catch (err) {
    next(err);
  }
};

exports.getMessage = async (req, res, next) => {
  try {
    const msg = await Message.findByPk(req.params.id);
    if (!msg) return next(new AppError('Message not found.', 404));
    if (!msg.isRead) {
      msg.isRead = true;
      await msg.save({ fields: ['isRead'] });
    }
    res.json({ success: true, data: msg });
  } catch (err) {
    next(err);
  }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const msg = await Message.findByPk(req.params.id);
    if (!msg) return next(new AppError('Message not found.', 404));
    await msg.destroy();
    res.json({ success: true, message: 'Message deleted.' });
  } catch (err) {
    next(err);
  }
};

/* ===== TESTIMONIALS ===== */
exports.getTestimonials = async (req, res, next) => {
  try {
    const testimonials = await Testimonial.findAll({
      where: { isActive: true }, order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: testimonials });
  } catch (err) {
    next(err);
  }
};

exports.getAllTestimonials = async (req, res, next) => {
  try {
    const testimonials = await Testimonial.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: testimonials });
  } catch (err) {
    next(err);
  }
};

exports.createTestimonial = async (req, res, next) => {
  try {
    const testimonial = await Testimonial.create(req.body);
    res.status(201).json({ success: true, data: testimonial });
  } catch (err) {
    next(err);
  }
};

exports.updateTestimonial = async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findByPk(req.params.id);
    if (!testimonial) return next(new AppError('Testimonial not found.', 404));
    Object.assign(testimonial, req.body);
    await testimonial.save();
    res.json({ success: true, data: testimonial });
  } catch (err) {
    next(err);
  }
};

exports.deleteTestimonial = async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findByPk(req.params.id);
    if (!testimonial) return next(new AppError('Testimonial not found.', 404));
    await testimonial.destroy();
    res.json({ success: true, message: 'Testimonial deleted.' });
  } catch (err) {
    next(err);
  }
};

/* ===== SETTINGS ===== */
exports.getSettings = async (req, res, next) => {
  try {
    const settings = await Setting.findAll({ order: [['key', 'ASC']] });
    const result = {};
    settings.forEach((s) => { result[s.key] = s.value; });
    res.json({ success: true, data: result, raw: settings });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const updates = req.body;
    const keys = Object.keys(updates);
    for (const key of keys) {
      await Setting.upsert({ key, value: String(updates[key]) });
    }
    const settings = await Setting.findAll({ order: [['key', 'ASC']] });
    const result = {};
    settings.forEach((s) => { result[s.key] = s.value; });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.getPublicServices = async (req, res, next) => {
  try {
    const services = await Service.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'duration', 'price', 'category', 'description'],
      order: [['category', 'ASC'], ['name', 'ASC']],
    });
    res.json({ success: true, services });
  } catch (err) {
    next(err);
  }
};
