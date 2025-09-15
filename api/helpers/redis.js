import Redis from 'ioredis';

export default class RedisDriver {
    static LOCK_KEY = 'redis_lock';
    static LOCK_TIMEOUT = 1000;

    constructor({
        host = 'localhost',
        port = 6379,
        expiration = 0
    } = {}) {
        this.connection = new Redis({ host, port });
        this.namespaceKey = null;
        this.expiration = expiration;
    }

    async get(key) {
        key = this.namespaceKey ? `${this.namespaceKey}:${key}` : key;
        const value = await this.connection.get(key);
        return JSON.parse(value);
    }

    async set(key, value, index = false) {
        const namespaceKey = this.namespaceKey ? `${this.namespaceKey}:${key}` : key;
        const args = [
            namespaceKey,
            JSON.stringify(value)
        ];

        if (this.expiration) {
            args.push('EX', this.expiration);
        }

        if (index !== false) {
            this.addIndex(key);
        }

        return await this.connection.set(...args);
    }

    namespace(key) {
        this.namespaceKey = key;
        return this;
    }

    async delete(key) {
        key = this.namespaceKey ? `${this.namespaceKey}:${key}` : key;
        return await this.connection.del(key);
    }

    async close() {
        await this.connection.quit();
    }

    async lock() {
        const lockValue = Date.now() + RedisDriver.LOCK_TIMEOUT + 1;
        const lock = await this.connection.set(RedisDriver.LOCK_KEY, lockValue, 'NX', 'PX', RedisDriver.LOCK_TIMEOUT);
        return lock ? lockValue : false;
    }

    async release() {
        await this.connection.del(RedisDriver.LOCK_KEY);
    }

    async addIndex(key) {
        const namespace = this.namespaceKey ? `${this.namespaceKey}:index` : 'index';
        await this.connection.zadd(namespace, Date.now(), key);
    }

    async find(start, end) {
        const namespace = this.namespaceKey ? `${this.namespaceKey}:index` : 'index';
        const ids = await this.connection.zrangebyscore(namespace, start, end);
        const results = await Promise.all(ids.map(id => this.get(id)));
        return results;
    }

    async removeIndex(key) {
        const namespace = this.namespaceKey ? `${this.namespaceKey}:index` : 'index';
        await this.connection.zrem(namespace, key);
    }

}