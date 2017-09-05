const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

const expenseSchema = new Schema({
    amount: Number,
    date: Date,
    category: String,
    currency: { type: ObjectId, ref: 'Currency' },
    comment: String,
    user_id: { type: ObjectId, ref: 'User' }
}, { timestamps: true });

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;
