const mongoose = require('mongoose');
const db = require('./db');

// Define schema post
const postSchema = new mongoose.Schema(
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
    content: {
      type: { type: Number },
      text: String
    },
    comments: [
      {
        author: String,
        name: String,
        picture: String,
        text: String
      }
    ],
    reacts: [
      {
        author: String,
        name: String,
        picture: String,
        reaction: Number
      }
    ],
    keys: []
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

module.exports = db.model('Post', postSchema);

// const mongoose = require('mongoose');
// const db = require('./db');

// // Define schema post
// const postSchema = new mongoose.Schema(
//   {
//     hash: {
//       type: String,
//       ref: 'Transaction'
//     },
//     author: {
//       type: String,
//       ref: 'Account'
//     },
//     picture: String,
//     name: String,
//     content: {
//       type: { type: Number },
//       text: String
//     },
//     comments: {
//       type: [
//         {
//           author: String,
//           name: String,
//           picture: String,
//           text: String
//         }
//       ],
//       default: []
//     },
//     reacts:  {
//       type: [
//         {
//           author: String,
//           name: String,
//           picture: String,
//           type: Number
//         }
//       ],
//       default: []
//     },

//     keys: []
//   },
//   { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
// );

// module.exports = db.model('Post', postSchema);
