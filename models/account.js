const mongoose = require('mongoose');
const db = require('./db')

// Define schema account
const accountSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, unique: true },
    info: {
      name: { type: String, default: 'anonymous' },
      picture: String,
      followings: []
    },
    enegry: { type: Number },
    balance: { type: Number, required: true },
    sequence: { type: Number, required: true },
    bandwidth: { type: Number, required: true },
    bandwidthTime: Date
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

module.exports = db.model('Account', accountSchema);
