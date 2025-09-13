import Queue from "./queue.js";

export default class ServiceRouter {

    static queue = new Queue();
    static services = {};

    constructor(serviceName, data) {
        const callback = async (data) => {
            if (!ServiceRouter.services[serviceName]) {
                throw new Error('Service not found.');
            }
            try {
                const service = await ServiceRouter.services[serviceName](data);
                return service;
            }
            catch (error) {
                console.error('Service error: ', error);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return callback(data);
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