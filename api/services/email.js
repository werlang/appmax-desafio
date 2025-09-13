import nodemailer from 'nodemailer';

export default class EmailService {

    constructor({ user, pass, host }={}) {
        this.user = user;
        this.pass = pass;
        this.host = host || 'smtp.gmail.com';

        this.transporter = null;

        if (!this.user || !this.pass) throw new Error('No email credentials provided.');
    }

    async init() {
        // Generate test SMTP service account from ethereal.email
        // Only needed if you don't have a real mail account for testing
        if (process.env.NODE_ENV !== 'production') {
            const testAccount = await nodemailer.createTestAccount();
            this.user = testAccount.user;
            this.pass = testAccount.pass;
            this.host = 'smtp.ethereal.email';
            console.log(this.host, this.user, this.pass);
        }

        // create reusable transporter object using the default SMTP transport
        if (!this.transporter) {
            this.transporter = nodemailer.createTransport({
                host: this.host,
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: { user: this.user, pass: this.pass },
                tls: { rejectUnauthorized: false },
                pool: true,
            });
            console.log('Email transporter created');
        }
    }

    close() {
        if (this.transporter) this.transporter.close();
    }

    build({
        subject = 'Subject',
        text = 'No plain text version were sent',
        html = '<b>This email is empty</b>',
    }) {
        this.mail = { subject, text, html };
        return this;
    }

    async send({
        receiver = false,
        sender = { name: 'Sender Name', address: 'sender@address.com' },
        verbose = false,

        // args from build
        subject,
        text,
        html,
        template,
    }) {

        if (!this.mail) this.build({ subject, text, html, template });

        await this.init();
        
        // send mail with defined transport object
        try {
            let info = await this.transporter.sendMail({
                from: typeof sender === 'object' ? `"${sender.name}" <${sender.address}>` : sender, // sender address
                to: receiver, // list of receivers, comma separated
                subject: this.mail.subject, // Subject line
                text: this.mail.text, // plain text body
                html: this.mail.html, // html body
            });

            const resp = {};

            resp.messageId = info.messageId;

            if (process.env.NODE_ENV !== 'production') {
                const preview = nodemailer.getTestMessageUrl(info);
                resp.preview = preview;
                // Preview only available when sending through an Ethereal account
                // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
                // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>
                if (verbose) {
                    console.log("Preview URL: %s", preview);
                    console.log("Message sent: %s", info.messageId);
                }
            }

            return resp;
        }
        catch (err) {
            console.log(err);
            throw new Error('Could not send email.');
        }
    }
}