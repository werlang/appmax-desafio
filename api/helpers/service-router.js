import Queue from "./queue.js";
import RedisDriver from "./redis.js";

export default class ServiceRouter {

    static queue = new Queue();
    static services = {};
    static redis = new RedisDriver({ host: 'redis' }).namespace('service');

    constructor(serviceName, data) {
        const callback = async (data) => {
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
                await new Promise(resolve => setTimeout(resolve, 1000));
                return callback(data);
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
        return ServiceRouter.queue.getPosition(this.id) + 1;
    }
}