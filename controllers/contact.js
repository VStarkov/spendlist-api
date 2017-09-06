const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
/**
* POST /contact
* Send a contact form via SendGrid.
*/
exports.postContact = (req, res) => {
    req.assert('name', 'Name cannot be blank').notEmpty();
    req.assert('email', 'Email is not valid').isEmail();
    req.assert('message', 'Message cannot be blank').notEmpty();

    const errors = req.validationErrors();

    if (errors) {
        res.status(400).send({ error: errors });
    }

    const mailOptions = {
        to: 'contact@spendlist.com',
        from: `${req.body.name} <${req.body.email}>`,
        subject: 'Contact Form | Spendlist',
        text: req.body.message
    };

    sgMail.send(mailOptions, (err) => {
        if (err) {
            return res.status(503).send({ msg: err.message });
        }

        res.status(200).send({ msg: 'Email has been sent successfully!' });
    });
};
