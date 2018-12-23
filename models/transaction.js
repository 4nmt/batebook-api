const mongoose = require('mongoose');
const db = require('./db')

// Define schema transaction
const transactionSchema = new mongoose.Schema(
  {
    hash: { type: String, required: true, unique: true },
    author: { type: String, required: true,  ref: 'Account' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

module.exports = db.model('Transaction', transactionSchema);
