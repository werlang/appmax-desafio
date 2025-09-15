import Queue from "./queue.js";
import RedisDriver from "./redis.js";

export default class ServiceRouter {

    static queue = new Queue();
    static services = {};
    static redis = new RedisDriver({ host: 'redis' }).namespace('service');

    constructor(serviceName, data) {
        const maxRetries = parseInt(process.env.MAX_RETRIES || '5');
        
        const callback = async (data, retryCount = 0) => {
            if (!ServiceRouter.services[serviceName]) {
                throw new Error('Service not found.');
            }
            try {
                const service = await ServiceRouter.services[serviceName](data);
                console.log(service);
                await ServiceRouter.redis.set(this.id, { data: service, completed: true, timestamp: Date.now() });
                return service;
            }
            catch (error) {
                console.error('Service error: ', error);
                
                if (retryCount >= maxRetries) {
                    throw new Error(`Service failed after ${maxRetries} retries: ${error.message}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                return callback(data, retryCount + 1);
            }
        }
        this.id = ServiceRouter.queue.add({ data, callback });
        ServiceRouter.redis.set(this.id, { data: null, position: this.getPosition(), timestamp: Date.now(), completed: false });
    }

    static register(name, callback) {
        ServiceRouter.services[name] = callback;
    }

    static async getService(id) {
        const service = await ServiceRouter.redis.get(id);
        if (service && !service.completed) {
            service.position = ServiceRouter.queue.getPosition(id);
        }
        return service;
    }

    getId() {
        return this.id;
    }

    getPosition() {
        const pos = ServiceRouter.queue.getPosition(this.id);
        return pos !== null ? pos + 1 : null;
    }
}