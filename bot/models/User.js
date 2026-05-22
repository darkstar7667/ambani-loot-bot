const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: Number,
  name: String,
  username: String,

  balance: {
    type: Number,
    default: 0
  },

  referrals: {
    type: Number,
    default: 0
  },

  referredBy: {
    type: Number,
    default: null
  },

  withdrawTotal: {
    type: Number,
    default: 0
  },

  joined: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);