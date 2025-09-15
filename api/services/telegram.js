export default class TelegramService {

    constructor(token){
        this.token = token;
        this.url = `https://api.telegram.org/bot${token}/sendMessage`;

    }

    async send(message) {
        if (process.env.NODE_ENV !== 'production') {
            const logMessage = `DEV LOG: Telegram message to chat ${message.chatId} - ${message.text}`;
            console.log(logMessage);
            return { message: logMessage };
        }

        const args = {
            // bot can obtain chat id after the user first interaction with it
            chat_id: message.chatId,
            text: message.text,
        }

        const url = `${this.url}?${ new URLSearchParams(args).toString() }`;
        try {
            await fetch(url).then(res => res.json());
            return { success: true };
        }
        catch (error){
            console.log('error sending telegram message', error);
            return { success: false, error };
        }

    }
}
