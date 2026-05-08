import meshLogger from './MeshLogger';

class RateLimiter {
  constructor() {
    this.limits = new Map(); // key -> { count, lastReset }
  }

  /**
   * Check if an action is allowed based on rate limits.
   * @param {string} key Unique key for the action (e.g., 'reconnect:node1')
   * @param {number} maxCount Max allowed in the window
   * @param {number} windowMs Window size in milliseconds
   */
  isAllowed(key, maxCount, windowMs) {
    const now = Date.now();
    let limit = this.limits.get(key);

    if (!limit || now - limit.lastReset > windowMs) {
      limit = { count: 1, lastReset: now };
      this.limits.set(key, limit);
      return true;
    }

    if (limit.count >= maxCount) {
      meshLogger.warn('ratelimit', `Rate limit exceeded for ${key}`);
      return false;
    }

    limit.count++;
    return true;
  }

  reset(key) {
    this.limits.delete(key);
  }
}

const rateLimiter = new RateLimiter();
export default rateLimiter;
