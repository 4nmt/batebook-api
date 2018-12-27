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

const PlainTextContent = vstruct([
  { name: 'type', type: vstruct.UInt8 },
  { name: 'text', type: vstruct.VarString(vstruct.UInt16BE) }
]);

const ReactContent = vstruct([
  { name: 'type', type: vstruct.UInt8 },
  { name: 'reaction', type: vstruct.UInt8 }
]);

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
        follows.addresses.map(f => {
          console.log(base32.encode(f));
        });
        break;
    }

    console.log(
      `${tx.hash}: ${account.address} update ${key} with ${value.length} bytes`
    );
  } else if (operation === 'interact') {
    // Check if object exists
    try {
      const { object, content } = tx.params;

      const { type, reaction } = ReactContent.decode(content);
      console.log(ReactContent.decode(content));

      console.log('type: ' + type);
      const {
        type: { t },
        text
      } = PlainTextContent.decode(content);
      console.log('text: ' + text);

      if (type === 1) {
        const comments = { text: 'aaa', author: 'a', picture: 'b', name: 'a' };
        const ccc = { text: 'bbb', author: 'b', picture: 'b', name: 'a' };

        let carr = [ccc];
        if (carr.some(p => p.author === comments.author)) {
          carr = carr.map(p => (p.author === comments.author ? comments : p));
        } else {
          carr = [...carr, comments];
        }
        console.log(carr);
      } else if (type === 2) {
        const { reaction } = ReactContent.decode(content);

        const reacts = { reaction, author: 'a', picture: 'a', name: 'a' };
        console.log(reacts);

        // post.comments = [...post.comments, reacts];
      } else {
        throw new Error('react type not found');
      }

      console.log(
        `${tx.hash}: ${account.address} interact ${object} with ${
          content.length
        } bytes`
      );
    } catch (e) {
      throw e;
    }
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

// (async () => {
//   // const tx =
//   //   'ATBJ34PBhsk0mJEuSi6bwIAEKKbwV4MbJ13gDROJrdAbeCBLAAAAAAAAAF8ABQAktYTnDJChBjDFZG6Zx8qQIYKSd2eR9m3VWZ4Ouf5AiJsAAgIC6JvrPAivAXWeG+FrgDyhMDvxzxjIWzrnNkSptqQ9tD6aqyHCsNOvT7d3IAOu4RQ3hoOHTiKYKN95EBALhrCGAQ==';
//   try {
//     const address = 'GA6IW2JOWMP4WGI6LYAZ76ZPMFQSJAX4YLJLOQOWFC5VF5C6IGNV2IW7';
//     const post = await Post.findOne(
//       {
//         hash: '59BEC35247D66FF111D4E54B9F78F448C25A7D2D7D5DCD61BDFB720AB131CDFB'
//       },
//       (err, account) => {
//         if (err) {
//           console.log(err);
//         }
//       }
//     );
    
//     const comments = { text: 'Hello', author: address, picture: '1', name: '2' };
//     post.comments = [...post.comments,comments];
//     await post.save();
//   } catch (err) {
//     throw err;
//   }
// })();
// const ReactContent = vstruct([
//   { name: 'type', type: vstruct.UInt8 },
//   { name: 'reaction', type: vstruct.UInt8 },
// ]);


let tx = {
  account: 'GBOVRS6DWD56GOIEYHFFYRLUBCV3JPQXRZ7YY4B34IHK6KWO4MQXGNZF',
  version: 1,
  sequence: 26,
  memo: Buffer.alloc(0),
  operation: 'interact',
  params: {
    object: '59BEC35247D66FF111D4E54B9F78F448C25A7D2D7D5DCD61BDFB720AB131CDFB',
    content: ReactContent.encode({
      type: 2,
      reaction : 1
    })
  }
};
var secretKey = 'SD6AU6SN3JTOOM6ESNXVE5JRHYNNQF3UDH2QFFKKBIWAWNV2POAWMDFK';
sign(tx, secretKey);
console.log(encode(tx).toString('hex'));
const Followings = vstruct([
  { name: 'addresses', type: vstruct.VarArray(vstruct.UInt16BE, vstruct.Buffer(35)) },
]);
// const Followings = vstruct([
//   { name: 'addresses', type: vstruct.VarArray(vstruct.UInt16BE, vstruct.Buffer(35)) },
// ]);
// let tx = {
//   account: 'GBOVRS6DWD56GOIEYHFFYRLUBCV3JPQXRZ7YY4B34IHK6KWO4MQXGNZF',
//   version: 1,
//   sequence: 9,
//   memo: Buffer.alloc(0),
//   operation: 'update_account',
//   params: {
//     key: 'followings',
//     value: Followings.encode({
//       addresses: [
//         base32.decode('GAXVLYJUYND6QKGHK4FGM44XK3U77KJY54VTUJNIORYASOUOHWO63Q7Q'),
//         base32.decode('GDKJTGPHZET53YN6DFXXJAWMZH6ZZ5YO6T5ZGJZWBTAKUV3JVHGCESRI'),
//         base32.decode('GB73OPHUZC3RSDEU2LYV5T7MEAN2Q26HYQPDYIENGNBUHW5CXAQ6UJOO'),
//         base32.decode('GAJQ47RMDTXYTCBMMW4A4DUMTB5RQLTGQZDMMABW6RTQJGKINJ4JTRTP'),
//       ]
//     })
//   }
// };
// var secretKey = 'SD6AU6SN3JTOOM6ESNXVE5JRHYNNQF3UDH2QFFKKBIWAWNV2POAWMDFK';
// sign(tx, secretKey);
// console.log(encode(tx).toString('hex'));

// const comments = { text : 'b', author: 'ds', picture : 'sd', name: 'ds' };
// const tmp = { text: 'b', author: 'ds', picture : 'sd', name: 'ds' };
// const a = _.union([tmp], [comments])
// console.log(a);
