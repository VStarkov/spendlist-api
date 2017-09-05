const moment = require('moment');

const thisWeekStart = moment().startOf('isoWeek');
const thisWeekEnd = moment().endOf('isoWeek');
const thisMonthStart = moment().startOf('month');
const thisMonthEnd = moment().endOf('month');

const prevWeekStart = moment().subtract(1, 'weeks').startOf('isoWeek');
const prevWeekEnd = moment().subtract(1, 'weeks').endOf('isoWeek');
const prevMonthStart = moment().subtract(1, 'months').startOf('month');
const prevMonthEnd = moment().subtract(1, 'months').endOf('month');

const momentFmt = date => moment(date, 'DD-MM-YYYY');

exports.getThisWeekAmount = data => data.filter(
    el =>
        momentFmt(el.date).isSameOrAfter(thisWeekStart) &&
        momentFmt(el.date).isSameOrBefore(thisWeekEnd)
).map(el => el.amount).reduce((a, b) => a + b, 0);

exports.getPrevWeekAmount = data => data.filter(
    el =>
        momentFmt(el.date).isSameOrAfter(prevWeekStart) &&
        momentFmt(el.date).isSameOrBefore(prevWeekEnd)
).map(el => el.amount).reduce((a, b) => a + b, 0);


exports.getThisMonthAmount = data => data.filter(
    el =>
        momentFmt(el.date).isSameOrAfter(thisMonthStart) &&
        momentFmt(el.date).isSameOrBefore(thisMonthEnd)
).map(el => el.amount).reduce((a, b) => a + b, 0);

exports.getPrevMonthAmount = data => data.filter(
    el =>
        momentFmt(el.date).isSameOrAfter(prevMonthStart) &&
        momentFmt(el.date).isSameOrBefore(prevMonthEnd)
).map(el => el.amount).reduce((a, b) => a + b, 0);
