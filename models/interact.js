const mongoose = require('mongoose');
const db = require('./db');

// Define schema post
const interactSchema = new mongoose.Schema(
  {
    hash: {
      type: String,
      ref: 'Transaction'
    },
    author: {
      type: String,
      ref: 'Account'
    },
    picture: String,
    name: String,
    operation: String,
    params: mongoose.Schema.Types.Mixed,
    comments: {
      type: [
        {
          author: String,
          name: String,
          picture: String,
          text: String
        }
      ],
      default: []
    },
    reacts: {
      type: [
        {
          author: String,
          name: String,
          picture: String,
          reaction: Number
        }
      ],
      default: []
    }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

module.exports = db.model('Interact', interactSchema);
