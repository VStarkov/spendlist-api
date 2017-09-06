const async = require('async');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const passport = require('passport');
const User = require('../models/User');
const defaultCategories = require('../constants').categories;
const mongoose = require('mongoose');

/**
* Login Required middleware.
*/
exports.isAuthenticated = (req, res, next) => {
    if (req.user) {
        next();
    } else {
        return res.status(401).json({ error: { msg: 'Unauthorized user!' } });
    }
};

/**
* POST /api/login
* Sign in using email and password.
*/
exports.postLogin = (req, res, next) => {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('password', 'Password cannot be blank').notEmpty();
    req.sanitize('email').normalizeEmail({ remove_dots: false });

    const errors = req.validationErrors();

    if (errors) {
        res.status(400).json({ error: errors });
    } else {
        passport.authenticate('local', (err, user, info) => {
            if (err) { return next(err); }
            if (!user) {
                res.status(401).json({ error: info });
            } else {
                return res.status(200).json({ token: jwt.sign({
                    email: user.email,
                    familyMembers: user.familyMembers,
                    profile: user.profile,
                    categories: user.categories,
                    id: user._id
                }, process.env.SESSION_SECRET) });
            }
        })(req, res, next);
    }
};

/**
* POST /api/signup
* Create a new local account.
*/
exports.postSignup = (req, res, next) => {
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('password', 'Password must be at least 4 characters long').len(4);
    req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);
    req.sanitize('email').normalizeEmail({ remove_dots: false });

    const errors = req.validationErrors();

    if (errors) {
        return res.status(400).json({ error: errors });
    }

    const user = new User({
        email: req.body.email,
        password: req.body.password,
        categories: defaultCategories
    });

    User.findOne({ email: req.body.email }, (err, existingUser) => {
        if (err) { return next(err); }
        if (existingUser) {
            return res.status(400).json({ error: { msg: 'Account with that email address already exists.' } });
        }
        user.save((err, user) => {
            if (err) { return next(err); }

            res.status(200).json(user);
        });
    });
};

/**
* POST /api/account/profile
* Update profile information.
*/
exports.postUpdateProfile = (req, res, next) => {
    req.assert('email', 'Please enter a valid email address.').isEmail();
    req.sanitize('email').normalizeEmail({ remove_dots: false });

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/account');
    }

    User.findById(req.user.id, (err, user) => {
        if (err) { return next(err); }
        user.email = req.body.email || '';
        user.profile.name = req.body.name || '';
        user.profile.gender = req.body.gender || '';
        user.profile.location = req.body.location || '';
        user.profile.website = req.body.website || '';
        user.save((err) => {
            if (err) {
                if (err.code === 11000) {
                    req.flash('errors', { msg: 'The email address you have entered is already associated with an account.' });
                    return res.redirect('/account');
                }
                return next(err);
            }
            req.flash('success', { msg: 'Profile information has been updated.' });
            res.redirect('/account');
        });
    });
};

/**
* POST /api/account/password
* Update current password.
*/
exports.postUpdatePassword = (req, res, next) => {
    req.assert('password', 'Password must be at least 4 characters long').len(4);
    req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);

    const errors = req.validationErrors();

    if (errors) {
        res.status(500).json(errors);
    }

    User.findById(req.user.id, (err, user) => {
        if (err) { return next(err); }
        user.password = req.body.password;
        user.save((err) => {
            if (err) { return next(err); }

            res.status(200).json({ msg: 'Password has been changed.' });
        });
    });
};

/**
* POST /api/account/delete
* Delete user account.
*/
exports.postDeleteAccount = (req, res, next) => {
    User.remove({ _id: req.user.id }, (err) => {
        if (err) { return next(err); }

        res.status(200).json({ msg: 'Your account has been deleted.' });
    });
};

/**
* GET /account/unlink/:provider
* Unlink OAuth provider.
*/
exports.getOauthUnlink = (req, res, next) => {
    const provider = req.params.provider;
    User.findById(req.user.id, (err, user) => {
        if (err) { return next(err); }
        user[provider] = undefined;
        user.tokens = user.tokens.filter(token => token.kind !== provider);
        user.save((err) => {
            if (err) { return next(err); }
            req.flash('info', { msg: `${provider} account has been unlinked.` });
            res.redirect('/account');
        });
    });
};

/**
* POST /reset/:token
* Process the reset password request.
*/
exports.postReset = (req, res, next) => {
    req.assert('password', 'Password must be at least 4 characters long.').len(4);
    req.assert('confirm', 'Passwords must match.').equals(req.body.password);

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('back');
    }

    async.waterfall([
        function resetPassword(done) {
            User
            .findOne({ passwordResetToken: req.params.token })
            .where('passwordResetExpires').gt(Date.now())
            .exec((err, user) => {
                if (err) { return next(err); }
                if (!user) {
                    req.flash('errors', { msg: 'Password reset token is invalid or has expired.' });
                    return res.redirect('back');
                }
                user.password = req.body.password;
                user.passwordResetToken = undefined;
                user.passwordResetExpires = undefined;
                user.save((err) => {
                    if (err) { return next(err); }
                    req.logIn(user, (err) => {
                        done(err, user);
                    });
                });
            });
        },
        function sendResetPasswordEmail(user, done) {
            const transporter = nodemailer.createTransport({
                service: 'SendGrid',
                auth: {
                    user: process.env.SENDGRID_USER,
                    pass: process.env.SENDGRID_PASSWORD
                }
            });
            const mailOptions = {
                to: user.email,
                from: 'hackathon@starter.com',
                subject: 'Your Hackathon Starter password has been changed',
                text: `Hello,\n\nThis is a confirmation that the password for your account ${user.email} has just been changed.\n`
            };
            transporter.sendMail(mailOptions, (err) => {
                req.flash('success', { msg: 'Success! Your password has been changed.' });
                done(err);
            });
        }
    ], (err) => {
        if (err) { return next(err); }
        res.redirect('/');
    });
};

/**
* POST /forgot
* Create a random token, then the send user an email with a reset link.
*/
exports.postForgot = (req, res, next) => {
    req.assert('email', 'Please enter a valid email address.').isEmail();
    req.sanitize('email').normalizeEmail({ remove_dots: false });

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/forgot');
    }

    async.waterfall([
        function createRandomToken(done) {
            crypto.randomBytes(16, (err, buf) => {
                const token = buf.toString('hex');
                done(err, token);
            });
        },
        function setRandomToken(token, done) {
            User.findOne({ email: req.body.email }, (err, user) => {
                if (err) { return done(err); }
                if (!user) {
                    req.flash('errors', { msg: 'Account with that email address does not exist.' });
                    return res.redirect('/forgot');
                }
                user.passwordResetToken = token;
                user.passwordResetExpires = Date.now() + 3600000; // 1 hour
                user.save((err) => {
                    done(err, token, user);
                });
            });
        },
        function sendForgotPasswordEmail(token, user, done) {
            const transporter = nodemailer.createTransport({
                service: 'SendGrid',
                auth: {
                    user: process.env.SENDGRID_USER,
                    pass: process.env.SENDGRID_PASSWORD
                }
            });
            const mailOptions = {
                to: user.email,
                from: 'hackathon@starter.com',
                subject: 'Reset your password on Hackathon Starter',
                text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
                Please click on the following link, or paste this into your browser to complete the process:\n\n
                http://${req.headers.host}/reset/${token}\n\n
                If you did not request this, please ignore this email and your password will remain unchanged.\n`
            };
            transporter.sendMail(mailOptions, (err) => {
                req.flash('info', { msg: `An e-mail has been sent to ${user.email} with further instructions.` });
                done(err);
            });
        }
    ], (err) => {
        if (err) { return next(err); }
        res.redirect('/forgot');
    });
};

/**
* POST /account/addfamily
* Send request for a family member adding
*/
exports.addFamily = (req, res) => {
    function handleError(err) {
        req.flash('errors', err);
        return res.redirect('/account');
    }

    req.assert('email', 'Please enter a valid email address.').isEmail();
    req.sanitize('email').normalizeEmail({ remove_dots: false });

    const errors = req.validationErrors();

    if (errors) {
        return handleError(errors);
    }

    User.findOne({ email: req.body.email }, (err, user) => {
        if (!user || err) {
            const error = err || { msg: 'Account with that email address does not exist.' };
            return handleError(error);
        }

        if (typeof user.familyMembers === 'undefined') {
            user.familyMembers = [];
        }
        if (typeof user.familyMemberRequests === 'undefined') {
            user.familyMemberRequests = [];
        }

        const userId = mongoose.Types.ObjectId(req.user.id);

        if (
            user.familyMembers.indexOf(userId) === -1 &&
            user.familyMemberRequests.indexOf(userId) === -1
            ) {
            user.familyMemberRequests.push(userId);
        } else {
            const error = {
                msg: 'Account you\'re trying to add is already your family member.'
            };
            return handleError(error);
        }

        user.markModified('familyMemberRequests');

        user.save((err) => {
            if (err) {
                return handleError(err);
            }

            req.flash('success', { msg: 'Add family member request has been sent.' });
            return res.redirect('/account');
        });
    });
};

/**
* POST /account/approvefamily
* Send request for a family member adding
*/
exports.approveFamily = (req, res) => {
    function handleError(err) {
        req.flash('errors', err);
        return res.redirect('/account');
    }

    if (typeof req.body.approve === 'undefined') {
        handleError({ msg: 'Request error' });
    }
    req.sanitize('email').normalizeEmail({ remove_dots: false });

    const myUserId = mongoose.Types.ObjectId(req.user.id);

    User.findOne({ email: req.body.email }, (err, user) => {
        if (err) {
            handleError(err);
        }
        const familyUserId = mongoose.Types.ObjectId(user.id);

        if (req.body.approve === 'true') {
            if (user.familyMembers.indexOf(myUserId) === -1) {
                user.familyMembers.push(myUserId);
            }

            user.markModified('familyMembers');

            user.save((err) => {
                if (err) {
                    return handleError(err);
                }

                User.findById(myUserId, (err, me) => {
                    if (err) {
                        handleError(err);
                    }
                    if (me.familyMembers.indexOf(familyUserId) === -1) {
                        me.familyMembers.push(familyUserId);
                    }

                    me.familyMemberRequests = me.familyMemberRequests.filter(
                        el => el.toString() !== familyUserId.toString()
                    );

                    me.markModified('familyMemberRequests');

                    me.save((err) => {
                        if (err) {
                            return handleError(err);
                        }

                        req.flash('success', { msg: 'Family member request approved.' });
                        return res.redirect('/account');
                    });
                });
            });
        } else if (req.body.approve === 'false') {
            User.findById(myUserId, (err, me) => {
                if (err) {
                    handleError(err);
                }

                me.familyMemberRequests = me.familyMemberRequests.filter(
                    el => el.toString() !== familyUserId.toString()
                );

                me.markModified('familyMemberRequests');

                me.save((err) => {
                    if (err) {
                        return handleError(err);
                    }

                    req.flash('info', { msg: 'Family member request rejected.' });
                    return res.redirect('/account');
                });
            });
        }
    });
};
