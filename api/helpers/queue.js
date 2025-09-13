import crypto from 'crypto';

export default class Queue {
    constructor() {
        this.queue = [];
        this.updateCallbacks = [];
        this.running = false;
    }

    add(item) {
        item.id = crypto.randomUUID();
        this.queue.push(item);
        this.process();
        return item.id;
    }

    async process() {
        if (this.running || this.queue.length === 0) {
            return;
        }
        this.running = true;

        const item = this.queue.shift();
        try {
            await item.callback(item.data);

            this.updateCallbacks.forEach(q => {
            const position = this.getPosition(q.id);
            if (position === null) {
                q.status = 'completed';
            }
            else {
                q.callback({ position });
            }
        });
        this.updateCallbacks = this.updateCallbacks.filter(q => q.status === 'pending');
        } catch (error) {
            console.error('Error processing queue item:', error);
        } finally {
            this.running = false;
            this.process();
        }
    }

    getSize() {
        return this.queue.length;
    }

    getPosition(id) {
        const position = this.queue.findIndex(item => item.id === id);
        return position !== -1 ? position + 1 : null;
    }

    onUpdate(id, callback) {
        this.updateCallbacks.push({ id, callback, status: 'pending' });
    }
}