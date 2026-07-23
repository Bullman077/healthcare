const Patient = require('./Patient');
const Service = require('./Service');
const Appointment = require('./Appointment');
const Admin = require('./Admin');
const Message = require('./Message');
const Testimonial = require('./Testimonial');
const Setting = require('./Setting');

Patient.hasMany(Appointment, { foreignKey: 'patientId', as: 'appointments' });
Appointment.belongsTo(Patient, { foreignKey: 'patientId', as: 'patient' });

Service.hasMany(Appointment, { foreignKey: 'serviceId', as: 'appointments' });
Appointment.belongsTo(Service, { foreignKey: 'serviceId', as: 'service' });

module.exports = { Patient, Service, Appointment, Admin, Message, Testimonial, Setting };
