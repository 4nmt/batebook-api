const mongoose = require('mongoose');
const db = require('./db')

// Define schema post
const postSchema = new mongoose.Schema(
  {
    author: {
      type: String,
      ref: 'Account'
    },
    content: {
      type: {type: Number},
      text: String
    },
    keys: []
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

module.exports = db.model('Post', postSchema);
