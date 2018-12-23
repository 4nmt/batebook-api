const mongoose = require('mongoose');
const db = require('./db')

// Define schema account
const blockSchema = new mongoose.Schema(
  {
    height: { type: Number, required: true, unique: true },
    time: { type: Date, required: true },
    hash: { type: String, required: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

module.exports = db.model('Block', blockSchema);
