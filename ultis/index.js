const axios = require('axios');

const isTxValid = hash => {
  axios.get(`https://dragonfly.forest.network/tx?hash=0x${hash}`).then(res => {
    const { result, error } = res.data;
    if (error) {
      return false;
    }
    const {
      tx_result: { tags }
    } = result;
    console.log("tags" +Boolean(tags) );
    
    return Boolean(tags);
  });
};

module.exports = { isTxValid };
