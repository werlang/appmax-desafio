export default class TelegramService {

    constructor(token){
        this.token = token;
        this.url = `https://api.telegram.org/bot${token}/sendMessage`;

    }

    async send(message) {
        if (process.env.NODE_ENV !== 'production') {
            console.log('DEV LOG: Telegram alert:', message);
            return true;
        }

        const args = {
            // bot can obtain chat id after the user first interaction with it
            chat_id: message.chatId,
            text: message.text,
        }

        const url = `${this.url}?${ new URLSearchParams(args).toString() }`;
        try {
            return await fetch(url).then(res => res.json());
        }
        catch (error){
            console.log('error sending telegram message', error);
            return false;
        }

    }
}
