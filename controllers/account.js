const Account = require('../models/account');

exports.findByPublicKey = async (req, res) => {
  try {
    const {publicKey} = req.params;
    const account = await Account.findOne({address:  publicKey });
    res.status(200).json(account)
    console.log(account);
  } catch (err) {
    res.status(err.code || 500).json({ message: err.message });
  }
};

