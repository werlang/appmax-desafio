import Queue from "./queue.js";

export default class ServiceRouter {

    static queue = new Queue();
    static services = {};

    constructor(serviceName, data) {
        this.id = ServiceRouter.queue.add({
            data,
            callback: async (data) => {
                if (!ServiceRouter.services[serviceName]) {
                    throw new Error('Service not found.');
                }
                const service = await ServiceRouter.services[serviceName](data);
                return service;
            }
        });
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