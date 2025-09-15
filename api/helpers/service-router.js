import Queue from "./queue.js";

export default class ServiceRouter {

    static queue = new Queue();
    static services = {};

    constructor(serviceName, data) {
        const envValue = process.env.MAX_RETRIES;
        let maxRetries = 5; // default value
        
        if (envValue !== undefined) {
            const parsed = parseInt(envValue);
            if (!isNaN(parsed) && parsed >= 0) {
                maxRetries = parsed;
            }
        }
        
        const callback = async (data, retryCount = 0) => {
            if (!ServiceRouter.services[serviceName]) {
                throw new Error('Service not found.');
            }
            try {
                const service = await ServiceRouter.services[serviceName](data);
                return service;
            }
            catch (error) {
                console.error(`Service error (attempt ${retryCount + 1}/${maxRetries + 1}): `, error);
                
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return callback(data, retryCount + 1);
                } else {
                    console.error(`Maximum retries (${maxRetries}) exceeded for service ${serviceName}`);
                    throw error;
                }
            }
        }
        this.id = ServiceRouter.queue.add({ data, callback });
    }

    static register(name, callback) {
        ServiceRouter.services[name] = callback;
    }

    getId() {
        return this.id;
    }

    getPosition() {
        return ServiceRouter.queue.getPosition(this.id) + 1;
    }
}