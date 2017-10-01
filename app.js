/**
* Module dependencies.
*/
const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const logger = require('morgan');
const chalk = require('chalk');
const errorHandler = require('errorhandler');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const passport = require('passport');
const expressValidator = require('express-validator');
const expressStatusMonitor = require('express-status-monitor');

/**
* Load environment variables from .env file
*/
dotenv.load({ path: '.env' });

/**
* Controllers (route handlers).
*/
const userController = require('./controllers/user');
const expenseController = require('./controllers/expense');
const contactController = require('./controllers/contact');

/**
* API keys and Passport configuration.
*/
require('./config/passport');

/**
* Create Express server.
*/
const app = express();

/**
* Connect to MongoDB.
*/
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);
mongoose.connection.on('error', () => {
    console.log('%s MongoDB connection error. Please make sure MongoDB is running.', chalk.red('✗'));
    process.exit();
});

/**
* Express configuration.
*/
app.set('port', process.env.PORT || 3001);
app.use(expressStatusMonitor());
app.use(compression());
app.use(logger('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(expressValidator());
app.use((req, res, next) => {
    try {
        const token = req.body.token || req.query.token || req.headers['x-access-token'];

        if (token) {
            jwt.verify(token, process.env.SESSION_SECRET, (err, decode) => {
                if (err) {
                    req.user = null;
                } else {
                    req.user = decode;
                }
                next();
            });
        } else {
            req.user = null;
            next();
        }
    } catch (e) {
        req.user = null;
        next();
    }
});
app.use(passport.initialize());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, x-access-token');
    next();
});
app.disable('x-powered-by');

/**
* Primary app routes.
*/
app.post('/api/login', userController.postLogin);
app.post('/api/forgot', userController.postForgot);
app.post('/api/reset/:token', userController.postReset);
app.post('/api/signup', userController.postSignup);

app.post('/api/contact', contactController.postContact);

app.get('/api/expenses', userController.isAuthenticated, expenseController.getExpenses);
app.post('/api/expenses/add', userController.isAuthenticated, expenseController.addExpense);
app.get('/api/expenses/delete', userController.isAuthenticated, expenseController.deleteExpense);
app.post('/api/expenses/edit', userController.isAuthenticated, expenseController.editExpense);

app.post('/api/account/profile', userController.isAuthenticated, userController.postUpdateProfile);
app.post('/api/account/password', userController.isAuthenticated, userController.postUpdatePassword);
app.post('/api/account/delete', userController.isAuthenticated, userController.postDeleteAccount);
app.post('/api/account/addfamily', userController.isAuthenticated, userController.addFamily);
app.post('/api/account/approvefamily', userController.isAuthenticated, userController.approveFamily);
app.get('/api/account/unlink/:provider', userController.isAuthenticated, userController.getOauthUnlink);

/**
* OAuth authentication routes. (Sign in)
*/
app.get('/auth/instagram', passport.authenticate('instagram'));
app.get('/auth/instagram/callback', passport.authenticate('instagram', { failureRedirect: '/login' }), (req, res) => {
    res.redirect(req.session.returnTo || '/');
});
app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'user_location'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), (req, res) => {
    res.redirect(req.session.returnTo || '/');
});
app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), (req, res) => {
    res.redirect(req.session.returnTo || '/');
});
app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
    res.redirect(req.session.returnTo || '/');
});
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), (req, res) => {
    res.redirect(req.session.returnTo || '/');
});
app.get('/auth/linkedin', passport.authenticate('linkedin', { state: 'SOME STATE' }));
app.get('/auth/linkedin/callback', passport.authenticate('linkedin', { failureRedirect: '/login' }), (req, res) => {
    res.redirect(req.session.returnTo || '/');
});

/**
* OAuth authorization routes.
*/
app.get('/auth/foursquare', passport.authorize('foursquare'));
app.get('/auth/foursquare/callback', passport.authorize('foursquare', { failureRedirect: '/api' }), (req, res) => {
    res.redirect('/api/foursquare');
});
app.get('/auth/tumblr', passport.authorize('tumblr'));
app.get('/auth/tumblr/callback', passport.authorize('tumblr', { failureRedirect: '/api' }), (req, res) => {
    res.redirect('/api/tumblr');
});
app.get('/auth/steam', passport.authorize('openid', { state: 'SOME STATE' }));
app.get('/auth/steam/callback', passport.authorize('openid', { failureRedirect: '/login' }), (req, res) => {
    res.redirect(req.session.returnTo || '/');
});
app.get('/auth/pinterest', passport.authorize('pinterest', { scope: 'read_public write_public' }));
app.get('/auth/pinterest/callback', passport.authorize('pinterest', { failureRedirect: '/login' }), (req, res) => {
    res.redirect('/api/pinterest');
});

/**
* Error Handler.
*/
app.use(errorHandler());

/**
* Start Express server.
*/
app.listen(app.get('port'), () => {
    console.log('%s App is running at http://localhost:%d in %s mode', chalk.green('✓'), app.get('port'), app.get('env'));
});

module.exports = app;
