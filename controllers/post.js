const Post = require('../models/post');

exports.findByPublicKey = async (req, res) => {
  try {
    const {publicKey} = req.params;
    const posts = await Post.find({author:  publicKey });
    res.status(200).json(posts)
    console.log(posts);
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message });
  }
};

exports.findByhash = async (req, res) => {
  try {
    const {hash} = req.params;
    const posts = await Post.findOne({hash });
    res.status(200).json(posts)
    console.log(posts);
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message });
  }
};
