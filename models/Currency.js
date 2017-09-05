const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const currencySchema = new Schema({
    name: Number,
    shortcut: String,
    symbol: String
});

const Currency = mongoose.model('Currency', currencySchema);

module.exports = Currency;
