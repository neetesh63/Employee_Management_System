const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
      match: [/^EMP\d{3,}$/, 'Employee ID must be in format EMP001'],
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email.'],
    },
    phone: { type: String, trim: true, maxlength: 20 },
    profilePhoto: { type: String, default: '' }, // URL
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    designation: { type: String, required: true, trim: true, maxlength: 100 },
    joiningDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'inactive', 'on_leave'],
      default: 'active',
    },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'intern'],
      default: 'full_time',
    },
    salary: { type: Number, required: true, min: 0, max: 100_000_000 },
    performanceRating: { type: Number, min: 1, max: 5, default: 4 },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''],
      default: '',
    },
    emergencyContact: {
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      relation: { type: String, trim: true, default: '' },
    },
    reportingManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },
    skills: [{ type: String, trim: true, maxlength: 60 }],
    address: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// Indexes for fast queries
employeeSchema.index({ name: 'text', email: 'text', employeeId: 'text', designation: 'text' });
employeeSchema.index({ department: 1, status: 1 });
employeeSchema.index({ joiningDate: -1 });
employeeSchema.index({ salary: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
