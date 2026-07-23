const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const Service = require('../models/Service');

const appointmentRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),

  body('phone')
    .trim()
    .notEmpty().withMessage('Phone is required')
    .matches(/^[\d\s\-+()]{7,20}$/).withMessage('Enter a valid phone number'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Enter a valid email address')
    .normalizeEmail(),

  body('service')
    .trim()
    .notEmpty().withMessage('Service is required')
    .custom(async (value) => {
      const service = await Service.findOne({
        where: { name: { [Op.iLike]: value.trim() }, isActive: true },
      });
      if (!service) {
        throw new Error(`Service "${value}" is not available. Please select a valid service.`);
      }
      return true;
    }),

  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Invalid date format')
    .custom((value) => {
      const d = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d <= today) throw new Error('Date must be in the future');
      if (d.getDay() === 0) throw new Error('We are closed on Sundays');
      return true;
    }),

  body('time')
    .notEmpty().withMessage('Time is required')
    .isIn([
      '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
      '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM',
      '4:00 PM', '5:00 PM',
    ]).withMessage('Invalid time slot'),

  body('message')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 1000 }).withMessage('Message cannot exceed 1000 characters'),
];

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    return res.status(400).json({ success: false, message: messages.join('; ') });
  }
  next();
}

module.exports = { appointmentRules, validate };
