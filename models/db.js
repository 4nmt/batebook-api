var mongoose = require('mongoose');
var config = require('../config')

// Connect MongoDB
mongoose.set('useCreateIndex', true)
mongoose.connect(process.env.MONGODB_URI || config.MONGO_URL, { useNewUrlParser: true })
const db = mongoose.connection
db.on('open', () => {
  console.log('DB connected')
})
db.on('error', (err) => console.log(err));

module.exports = db