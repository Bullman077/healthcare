const { Op } = require('sequelize');
const { Message, Testimonial, Setting, Service } = require('../models');
const { AppError } = require('../middleware/errorHandler');
const { sendNewMessageNotification } = require('../utils/email');
const { logAudit, resetStatsCache } = require('./adminController');

/* ===== MESSAGES ===== */
exports.submitMessage = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name || !email || !message) {
      return next(new AppError('Name, email, and message are required.', 400));
    }
    if (name.length > 100) {
      return next(new AppError('Name must be 100 characters or less.', 400));
    }
    if (message.length > 2000) {
      return next(new AppError('Message must be 2000 characters or less.', 400));
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return next(new AppError('Please provide a valid email address.', 400));
    }
    const msg = await Message.create({
      name: name.substring(0, 100),
      email: email.toLowerCase().substring(0, 255),
      phone: phone ? phone.substring(0, 20) : null,
      subject: subject ? subject.substring(0, 200) : null,
      message: message.substring(0, 2000),
    });
    res.status(201).json({ success: true, message: 'Thank you! We will get back to you soon.', data: { id: msg.id } });
    sendNewMessageNotification({ name, email, phone, subject, message }).catch((err) => {
      console.error('Failed to send contact notification email:', err.message);
    });
    // New message added, reset stats cache to update unread count
    resetStatsCache();
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
      // Marked as read, reset stats cache
      resetStatsCache();
    }
    res.json({ success: true, data: msg });
  } catch (err) {
    next(err);
  }
};

exports.toggleMessageRead = async (req, res, next) => {
  try {
    const msg = await Message.findByPk(req.params.id);
    if (!msg) return next(new AppError('Message not found.', 404));
    msg.isRead = !msg.isRead;
    await msg.save({ fields: ['isRead'] });
    await logAudit(req.admin, msg.isRead ? 'read' : 'unread', 'message', msg.id, { from: msg.name, subject: msg.subject }, req);
    // Toggled read status, reset stats cache
    resetStatsCache();
    res.json({ success: true, data: msg });
  } catch (err) {
    next(err);
  }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const msg = await Message.findByPk(req.params.id);
    if (!msg) return next(new AppError('Message not found.', 404));
    await logAudit(req.admin, 'delete', 'message', msg.id, { from: msg.name, email: msg.email, subject: msg.subject }, req);
    await msg.destroy();
    // Message deleted, reset stats cache
    resetStatsCache();
    res.json({ success: true, message: 'Message deleted.' });
  } catch (err) {
    next(err);
  }
};

/* ===== TESTIMONIALS ===== */
exports.getTestimonials = async (req, res, next) => {
  try {
    const testimonials = await Testimonial.findAll({
      where: { isActive: true, displayOnHome: true }, order: [['createdAt', 'DESC']],
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
    const allowedFields = ['name', 'title', 'content', 'rating', 'isActive', 'displayOnHome'];
    const filtered = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) filtered[field] = req.body[field];
    });
    const testimonial = await Testimonial.create(filtered);
    await logAudit(req.admin, 'create', 'testimonial', testimonial.id, { name: testimonial.name, rating: testimonial.rating }, req);
    res.status(201).json({ success: true, data: testimonial });
  } catch (err) {
    next(err);
  }
};

exports.updateTestimonial = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'title', 'content', 'rating', 'isActive', 'displayOnHome'];
    const testimonial = await Testimonial.findByPk(req.params.id);
    if (!testimonial) return next(new AppError('Testimonial not found.', 404));
    const changes = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== testimonial[field]) {
        changes[field] = { from: testimonial[field], to: req.body[field] };
      }
    });
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) testimonial[field] = req.body[field];
    });
    await testimonial.save();
    if (Object.keys(changes).length > 0) {
      await logAudit(req.admin, 'update', 'testimonial', testimonial.id, { name: testimonial.name, changes }, req);
    }
    res.json({ success: true, data: testimonial });
  } catch (err) {
    next(err);
  }
};

exports.deleteTestimonial = async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findByPk(req.params.id);
    if (!testimonial) return next(new AppError('Testimonial not found.', 404));
    await logAudit(req.admin, 'delete', 'testimonial', testimonial.id, { name: testimonial.name, content: testimonial.content.substring(0, 100) }, req);
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
    const allowedKeys = [
      'clinic_name', 'clinic_phone', 'clinic_email', 'clinic_address',
      'clinic_hours', 'clinic_tagline', 'hero_title', 'hero_subtitle',
      'about_text', 'privacy_policy', 'terms_of_service',
      'provider_name', 'provider_credentials', 'provider_photo_url',
      'provider_bio_p1', 'provider_bio_p2',
      'provider_philosophy_title', 'provider_philosophy_text',
      'value1_title', 'value1_text',
      'value2_title', 'value2_text',
      'value3_title', 'value3_text',
      'homepage_provider_quote',
      'hero_floating_name', 'hero_floating_title',
      'hero_stat1_number', 'hero_stat1_label',
      'hero_stat2_number', 'hero_stat2_label',
      'hero_stat3_number', 'hero_stat3_label',
      'hero_stat4_number', 'hero_stat4_label',
      'why_choose_title', 'why_choose_subtitle', 'why_choose_badge',
      'benefit1_title', 'benefit1_desc',
      'benefit2_title', 'benefit2_desc',
      'benefit3_title', 'benefit3_desc',
      'how_dpc_title', 'how_dpc_subtitle',
      'dpc_step1_title', 'dpc_step1_desc',
      'dpc_step2_title', 'dpc_step2_desc',
      'dpc_step3_title', 'dpc_step3_desc',
      'homepage_services_title', 'homepage_services_subtitle',
      'homepage_wellness_title', 'homepage_wellness_subtitle',
      'wellness1_title', 'wellness1_desc',
      'wellness2_title', 'wellness2_desc',
      'wellness3_title', 'wellness3_desc',
      'comparison_title', 'comparison_subtitle',
      'faq_title', 'faq_intro',
      'cta_title', 'cta_text',
      'testimonials_section_title', 'testimonials_section_subtitle',
      'telehealth_hero_badge', 'telehealth_hero_title', 'telehealth_hero_text',
      'telehealth_steps_title', 'telehealth_steps_subtitle',
      'telehealth_step1_title', 'telehealth_step1_desc',
      'telehealth_step2_title', 'telehealth_step2_desc',
      'telehealth_step3_title', 'telehealth_step3_desc',
      'telehealth_conditions_title', 'telehealth_conditions_subtitle',
      'contact_badge', 'contact_heading', 'contact_intro',
      'services_hero_title', 'services_hero_text',
      'services_section_title', 'services_section_subtitle', 'services_section_desc',
      'footer_brand_desc',
    ];
    const updates = req.body;
    const keys = Object.keys(updates).filter((k) => allowedKeys.includes(k));

    /* Capture old values for changed keys */
    const oldValues = {};
    for (const key of keys) {
      const existing = await Setting.findOne({ where: { key } });
      oldValues[key] = existing ? existing.value : null;
    }

    for (const key of keys) {
      await Setting.upsert({ key, value: String(updates[key]) });
    }

    /* Build rich change log */
    const changes = {};
    for (const key of keys) {
      const oldVal = oldValues[key] || '';
      const newVal = String(updates[key]);
      if (oldVal !== newVal) {
        changes[key] = { from: oldVal.substring(0, 80), to: newVal.substring(0, 80) };
      }
    }
    if (Object.keys(changes).length > 0) {
      await logAudit(req.admin, 'update', 'settings', null, {
        keysChanged: Object.keys(changes),
        count: Object.keys(changes).length,
        changes,
      }, req);
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
      attributes: ['id', 'name', 'description', 'duration', 'price', 'category', 'isActive', 'requiresPreparation', 'preparationInstructions', 'color', 'icon'],
      order: [['category', 'ASC'], ['name', 'ASC']],
    });
    res.json({ success: true, services });
  } catch (err) {
    next(err);
  }
};

exports.getSiteContent = async (req, res, next) => {
  try {
    const settings = await Setting.findAll({ order: [['key', 'ASC']] });
    const result = {};
    settings.forEach((s) => { result[s.key] = s.value; });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
