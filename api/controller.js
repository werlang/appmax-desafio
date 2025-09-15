import ServiceRouter from "./helpers/service-router.js";
import EmailService from "./services/email.js";
import SMSService from "./services/sms.js";
import TelegramService from "./services/telegram.js";

export default () => {
    ServiceRouter.register('email', async (data) => {
        const emailService = new EmailService({
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        });
        const resp = await emailService.send({
            receiver: data.to,
            subject: data.subject,
            text: data.message,
        });
        console.log('Email sent: ', resp);
        return resp;
    });
    
    ServiceRouter.register('telegram', async (data) => {
        const telegramService = new TelegramService(process.env.TELEGRAM_BOT_TOKEN);
        const resp = await telegramService.send({
            chatId: data.chatId,
            text: data.message,
        });
        console.log('Telegram message sent: ', resp);
        return resp;
    });
    
    ServiceRouter.register('sms', async (data) => {
        const smsService = new SMSService(process.env.SMS_API_KEY);
        const resp = await smsService.send({
            to: data.to,
            message: data.message,
            senderId: data.senderId,
        });
        console.log('SMS sent: ', resp);
        return resp;
    });
}