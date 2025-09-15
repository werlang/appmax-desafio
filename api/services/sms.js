export default class SMSService {

    constructor(apiKey){
        this.apiKey = apiKey;
    }

    // curl --location 'https://api.sms.to/sms/send' \
    // --header 'Authorization: Bearer <api_key>' \
    // --header 'Content-Type: application/json' \
    // --data '{
    //     "message": "This is test and \n this is a new line",
    //     "to": "+35799999999999",
    //     "bypass_optout": true,
    //     "sender_id": "SMSto",
    //     "callback_url": "https://example.com/callback/handler"
    // }'
    
    async send({
        to,
        message,
        senderId = 'SMSto',
        bypassOptout = true,
        callbackUrl = null,
    }) {
        if (process.env.NODE_ENV !== 'production') {
            const logMessage = `DEV LOG: SMS to ${to} - ${message}`;
            return { message: logMessage };
        }

        const url = 'https://api.sms.to/sms/send';
        const body = {
            message,
            to,
            sender_id: senderId,
            bypass_optout: bypassOptout,
        };
        if (callbackUrl) body.callback_url = callbackUrl;

        try {
            await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }).then(res => res.json());
            return { success: true }
        }
        catch (error){
            console.log('error sending sms', error);
            return { success: false, error };
        }

    }
}