// A minimal store interface used by routes: rpush, lrange, del, expire

export class MemoryStore {
  constructor() {
    this.keyToList = new Map();
    this.keyToTimer = new Map();
  }

  async rpush(key, value) {
    const list = this.keyToList.get(key) || [];
    list.push(value);
    this.keyToList.set(key, list);
    return list.length;
  }

  async lrange(key, start, stop) {
    const list = this.keyToList.get(key) || [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  async del(key) {
    const existed = this.keyToList.delete(key);
    const t = this.keyToTimer.get(key);
    if (t) {
      clearTimeout(t);
      this.keyToTimer.delete(key);
    }
    return existed ? 1 : 0;
  }

  async expire(key, ttlSeconds) {
    const t = this.keyToTimer.get(key);
    if (t) clearTimeout(t);
    const timer = setTimeout(() => {
      this.keyToList.delete(key);
      this.keyToTimer.delete(key);
    }, ttlSeconds * 1000);
    this.keyToTimer.set(key, timer);
    return 1;
  }
}

export class RedisStore {
  constructor(redis) {
    this.redis = redis;
  }
  async rpush(key, value) {
    return this.redis.rpush(key, value);
  }
  async lrange(key, start, stop) {
    return this.redis.lrange(key, start, stop);
  }
  async del(key) {
    return this.redis.del(key);
  }
  async expire(key, ttlSeconds) {
    return this.redis.expire(key, ttlSeconds);
  }
}



