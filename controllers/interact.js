const Interact = require('../models/interact');

exports.findByHash = async (req, res) => {
  try {
    const { hash } = req.params;
    const interacts = await Interact.findOne({hash });
    res.status(200).json(interacts);
    console.log(interacts);
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message });
  }
};

exports.findByPublicKey = async (req, res) => {
  try {
    const {publicKey} = req.params;
    const posts = await Interact.find({author:  publicKey });
    res.status(200).json(posts)
    console.log(posts);
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message });
  }
};
