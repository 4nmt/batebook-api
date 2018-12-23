const axios = require('axios');
const moment = require('moment');
const Decimal = require('decimal.js');
const _ = require('lodash');
const config = require('./config');
const { isTxValid } = require('./ultis');
const { encode, decode, verify, sign, hash } = require('./lib/tx');
var mongoose = require('mongoose');
const vstruct = require('varstruct');
const base32 = require('base32.js');
const { Keypair } = require('stellar-base');

const Account = require('./models/account');
const Block = require('./models/block');
const Post = require('./models/post');
const Transaction = require('./models/transaction');
// Connect MongoDB
mongoose.set('useCreateIndex', true);
mongoose.connect(
  process.env.MONGODB_URI || config.MONGO_URL,
  { useNewUrlParser: true }
);
const db = mongoose.connection;
db.on('open', () => {
  console.log('DB connected');
});
db.on('error', err => console.log(err));

const executeTx = async transaction => {
  const txSize = transaction.length;
  const tx = decode(transaction);
  tx.hash = hash(tx);
  console.log(tx.hash);

  const { operation } = tx;
  const res = await axios.get(
    `https://dragonfly.forest.network/tx?hash=0x${tx.hash}`
  );
  const { result, error } = res.data;
  if (error) {
    throw error;
  }
  const {
    tx_result: { tags }
  } = result;

  if (!Boolean(tags)) {
    throw new Error('transaction is invalid');
  }
  // Check account
  //   const account = await Account.findOne(
  //     { address: tx.account },
  //     (err, account) => {
  //       if (err) throw err;
  //     }
  //   );

  // Process operation
  if (operation === 'create_account') {
    const { address } = tx.params;
    // Check account
    await Account.findOne({ address: address }, async (err, account) => {
      if (err) throw err;

      if (account) {
        throw Error('Account address existed');
      } else {
        await Account.create({
          address,
          balance: 0,
          sequence: 0,
          bandwidth: 0
        });
      }
    });
    console.log(`${tx.hash}: ${account.address} created ${address}`);
  } else if (operation === 'payment') {
    const { address, amount } = tx.params;
    await Account.findOne({ address: address }, async (err, found) => {
      if (err) throw err;

      found.balance = new Decimal(found.balance).add(amount).toFixed();
      account.balance = new Decimal(account.balance).sub(amount).toFixed();
      await found.save();
      await account.save();
    });

    console.log(
      `${tx.hash}: ${account.address} transfered ${amount} to ${address}`
    );
  } else if (operation === 'post') {
    const { content, keys } = tx.params;
    const PlainTextContent = vstruct([
      { name: 'type', type: vstruct.UInt8 },
      { name: 'text', type: vstruct.VarString(vstruct.UInt16BE) }
    ]);
    try {
      const plx = PlainTextContent.decode(content);
      console.log(plx);
      console.log(typeof plx.type);

      console.log(typeof plx.text);
      await Post.create(
        {
          author: 'GBOVRS6DWD56GOIEYHFFYRLUBCV3JPQXRZ7YY4B34IHK6KWO4MQXGNZF',
          content: plx,
          keys
        },
        err => {
          if (err) throw err;
        }
      );
    } catch (e) {
      console.log(e);
    }

    console.log(
      `${tx.hash}: ${account.address} posted ${content.length} bytes with ${
        keys.length
      } keys`
    );
  } else if (operation === 'update_account') {
    const { key, value } = tx.params;
    const Followings = vstruct([
      {
        name: 'addresses',
        type: vstruct.VarArray(vstruct.UInt16BE, vstruct.Buffer(35))
      }
    ]);

    switch (key) {
      case 'name':
        console.log(value);
        console.log(value.toString('utf-8'));

        account.info.name = value.toString('utf-8');
        break;
      case 'picture':
        console.log(value);
        console.log(value.toString('base64'));
        account.info.picture = value.toString();
        break;
      case 'followings':
        const follows = Followings.decode(value);
        account.info.followings = follows.addresses.map(f => base32.encode(f));
        break;
    }
    await account.save();

    console.log(
      `${tx.hash}: ${account.address} update ${key} with ${value.length} bytes`
    );
  } else if (operation === 'interact') {
    // const { object, content } = tx.params;
    // Check if object exists
    // const transaction = await Transaction.findByPk(object, { transaction: dbTransaction });
    // if (!transaction) {
    // throw Error('Object does not exist');
    // }
    // tx.params.address = transaction.author;
    // console.log(`${tx.hash}: ${account.address} interact ${object} with ${content.length} bytes`);
  } else {
    throw Error('Operation is not support.');
  }

  // Check bandwidth usage < account balance
  const blockedAmount = Math.ceil(
    (account.bandwidth / config.NETWORK_BANDWIDTH) * MAX_CELLULOSE
  );
  console.log('Blocked amount:', blockedAmount);
  if (new Decimal(account.balance).lt(blockedAmount)) {
    throw Error(
      'Account balance must greater blocked amount due to bandwidth used'
    );
  }
};

(async () => {
  // const address = 'GA6IW2JOWMP4WGI6LYAZ76ZPMFQSJAX4YLJLOQOWFC5VF5C6IGNV2IW7'
  // const account=  await Account.findOne({address: address}, (err, account)=>{
  //     if (err) {
  //       console.log(err);
  //     }

  //     console.log(account.sequence);

  //   })
  //   account.sequence = 3
  //   await account.save()
  const tx =
    'ATATDn4sHO+JiCxluA4OjJh7GC5mhkbGADb0ZwSZSGp4mcZvAAAAAAAAAAgAAwANAAoBAAdIZWxsbyAzAGvYYnRUIjUoVVazdATpoitCEHuXfU0uMUoVrMar/NXiuKG8GrCMVlqKzjFEVXoMFyWCojZo7MClhXJkmbZnEAU=';
  const bufTx = Buffer.from(tx, 'base64');
  try {
    await executeTx(bufTx);
  } catch (err) {
    console.log(err);
  }
})();
