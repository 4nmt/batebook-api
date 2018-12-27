const axios = require('axios');
const moment = require('moment');
const Decimal = require('decimal.js');
const _ = require('lodash');
const config = require('./config');
const { isTxValid } = require('./ultis');
const { encode, decode, verify, sign, hash } = require('./lib/tx');
const vstruct = require('varstruct');
const base32 = require('base32.js');

const Account = require('./models/account');
const Block = require('./models/block');
const Post = require('./models/post');
const Interact = require('./models/interact');
const Transaction = require('./models/transaction');
const PlainTextContent = vstruct([
  { name: 'type', type: vstruct.UInt8 },
  { name: 'text', type: vstruct.VarString(vstruct.UInt16BE) }
]);

const ReactContent = vstruct([
  { name: 'type', type: vstruct.UInt8 },
  { name: 'reaction', type: vstruct.UInt8 }
]);

(async () => {
  try {
    console.log('Database schema synced!');
    // Try to init genesis account
    await Account.countDocuments({}, async (err, count) => {
      if (err) throw err;
      if (count === 0) {
        await Account.create(
          {
            address: config.GENESIS_ADDRESS,
            balance: config.MAX_CELLULOSE,
            sequence: 0,
            bandwidth: 0
          },
          (err, account) => {
            if (err) throw err;
          }
        );
      }
    });

    let pooling = 0;
    let previosHeight = 1;

    setTimeout(async function syncData() {
      let lastHeightResp = await axios.get(`${config.PUBLIC_URL}/abci_info`);
      let lastHeight = _.get(
        lastHeightResp,
        'data.result.response.last_block_height'
      );

      previosHeight = await Block.countDocuments({});

      if (previosHeight++ < lastHeight) {
        console.log('c' + +previosHeight);

        const resp = await axios.get(
          `${config.PUBLIC_URL}/block?height=${+previosHeight}`
        );

        const res = _.get(resp, 'data.result');
        const { data, header } = _.get(res, 'block');
        const { height, time } = header;
        console.log('d' + height);

        const currentBlock = { height, hash, time };
        await Block.create(
          {
            ...currentBlock
          },
          (err, account) => {
            if (err) throw err;
            console.log('Block' + previosHeight + 'is created');
          }
        );

        if (data && data.txs) {
          const txs = _.get(data, 'txs');
          txs.forEach(async tx => {
            const bufTx = Buffer.from(tx, 'base64');
            try {
              await executeTx(bufTx, currentBlock);
            } catch (err) {
              console.log(err);
            }
          });
        }
      } else {
        pooling = 0;
      }

      setTimeout(syncData, pooling);
    }, pooling);
  } catch (error) {
    console.log(error);
  }
})();

const executeTx = async (transaction, currentBlock) => {
  const txSize = transaction.length;
  const tx = decode(transaction);
  tx.hash = hash(tx);
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
  const account = await Account.findOne({ address: tx.account });
  console.log(account);

  account.sequence = new Decimal(account.sequence).add(1).toFixed();
  // Update bandwidth
  if (currentBlock) {
    const diff = account.bandwidthTime
      ? moment(currentBlock.time).unix() - moment(account.bandwidthTime).unix()
      : config.BANDWIDTH_PERIOD;
    const bandwidthLimit =
      (account.balance / config.MAX_CELLULOSE) * config.NETWORK_BANDWIDTH;
    // 24 hours window max 65kB
    account.bandwidth = Math.ceil(
      Math.max(0, (config.BANDWIDTH_PERIOD - diff) / config.BANDWIDTH_PERIOD) *
        account.bandwidth +
        txSize
    );
    if (account.bandwidth > bandwidthLimit) {
      throw Error('Bandwidth limit exceeded');
    }
    // Check bandwidth
    account.bandwidthTime = currentBlock.time;
    account.enegry = bandwidthLimit - account.bandwidth;
  }
  await account.save();

  // Process operation
  if (operation === 'create_account') {
    const { address } = tx.params;
    // Check account
    const found = await Account.findOne({ address: address });
    if (found) {
      throw new Error('account is exist');
    }
    await Account.create(
      {
        address,
        balance: 0,
        sequence: 0,
        bandwidth: 0,
        enegry: 0
      },
      err => {
        if (err) throw err;
        console.log('saved: ' + address);
      }
    );
    await Interact.create({
      hash: tx.hash,
      author: account.address,
      picture: account.info.picture,
      name: account.info.name,
      operation: operation,
      params: tx.params
    });
    console.log(`${tx.hash}: ${account.address} created ${address}`);
  } else if (operation === 'payment') {
    const { address, amount } = tx.params;
    const found = await Account.findOne({ address: address }, err => {
      if (err) throw err;
    });

    found.balance = new Decimal(found.balance).add(amount).toFixed();
    account.balance = new Decimal(account.balance).sub(amount).toFixed();
    await found.save();
    await account.save();
    await Interact.create({
      hash: tx.hash,
      author: account.address,
      picture: account.info.picture,
      name: account.info.name,
      operation: operation,
      params: tx.params
    });
    console.log(
      `${tx.hash}: ${account.address} transfered ${amount} to ${address}`
    );
  } else if (operation === 'post') {
    const { content, keys } = tx.params;

    try {
      const data = PlainTextContent.decode(content);
      await Post.create(
        {
          hash: tx.hash,
          author: account.address,
          name: account.info.name,
          picture: account.info.picture,
          content: data,
          keys
        },
        err => {
          if (err) throw err;
        }
      );
      await Interact.create({
        hash: tx.hash,
        author: account.address,
        picture: account.info.picture,
        name: account.info.name,
        operation: operation,
        params: {
          content: data,
          keys
        }
      });
    } catch (e) {
      throw e;
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
    let data;
    switch (key) {
      case 'name':
        account.info.name = value.toString('utf-8');
        data = value.toString('utf-8');
        break;
      case 'picture':
        account.info.picture = value.toString('base64');
        data = value.toString('base64');
        break;
      case 'followings':
        const follows = Followings.decode(value);
        const newfollowings = follows.addresses.map(f => base32.encode(f));
        account.info.followings = newfollowings;
        data = newfollowings;
        break;
    }
    console.log(key);
    console.log(data);
    
    const i = await Interact.create({
      hash: tx.hash,
      author: account.address,
      picture: account.info.picture,
      name: account.info.name,
      operation: operation,
      params: {
        key: key,
        value: data
      }
    });
    console.log(i);
    
    await account.save();
    console.log(
      `${tx.hash}: ${account.address} update ${key} with ${value.length} bytes`
    );
  } else if (operation === 'interact') {
    // Check if object exists
    try {
      const { object, content } = tx.params;
     
      // const interact = await Interact.findOne({ hash: object });
      // if (!interact) {
      //   throw Error('Object does not exist');
      // }
      const post = await Post.findOne({ hash: object });
      const { type, reaction } = ReactContent.decode(content);
      const found = await Account.findOne({ address: account.address });

      const {
        address,
        info: { picture, name }
      } = found;
      if (type === 1) {
        const { text } = PlainTextContent.decode(content);
        const comments = { text, author: address, picture, name };
        post.comments = [...post.comments, comments];
        // interact.comments = [...interact.comments, comments];
      } else if (type === 2) {
        const reacts = { reaction, author: address, picture, name };
        post.reacts = [...post.reacts, reacts];
        // interact.reacts = [...reacts.comments, comments];
      } else {
        throw new Error('react type not found');
      }

      await post.save();
      // await interact.save();

      console.log(
        `${tx.hash}: ${account.address} interact ${object} with ${
          content.length
        } bytes`
      );
    } catch (e) {
      throw e;
    }
  } else {
    throw Error('Operation is not support.');
  }

  // Check bandwidth usage < account balance
  const blockedAmount = Math.ceil(
    (account.bandwidth / config.NETWORK_BANDWIDTH) * config.MAX_CELLULOSE
  );
  console.log('Blocked amount:', blockedAmount);
  if (new Decimal(account.balance).lt(blockedAmount)) {
    throw Error(
      'Account balance must greater blocked amount due to bandwidth used'
    );
  }
  // Add transaction to db
  await Transaction.create(
    {
      hash: tx.hash,
      author: account.address
    },
    err => {
      if (err) throw err;
    }
  );
};
