// const axios = require('axios');

// (async () => {
//   const hash =
//     '03F3281A717994AD7688219F7FC7CCCFFAEA8B9F9A3CE243AC9B25C87AE21DC6';
//   const res = await axios.get(
//     `https://dragonfly.forest.network/tx?hash=0x${hash}`
//   );
//   const { result, error } = res.data;
//   console.log( res.data);

//   if (error) {
//     throw error;
//   }
//   const {
//     tx_result: { tags }
//   } = result;

//   if (!Boolean(tags)) {
//     throw new Error('transaction is invalid');
//   }
//   console.log(!Boolean(tags));
// })();

