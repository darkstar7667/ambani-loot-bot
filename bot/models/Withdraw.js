const mongoose = require('mongoose');

const withdrawSchema = new mongoose.Schema({
  userId: Number,
  amount: Number,
  wallet: String,
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Withdraw', withdrawSchema);
