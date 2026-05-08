/**
 * Structured logger for the Mesh system.
 * Tagged with session ID and module name.
 */
class MeshLogger {
  constructor() {
    this.sessionId = 'INIT';
  }

  setSessionId(id) {
    this.sessionId = id;
  }

  _log(level, module, message, ...args) {
    const timestamp = new Date().toISOString();
    const tag = `[MESH][${this.sessionId}][${module.toUpperCase()}]`;
    const msg = `${timestamp} ${tag} ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(msg, ...args);
        break;
      case 'info':
        console.log(msg, ...args);
        break;
      case 'warn':
        console.warn(msg, ...args);
        break;
      case 'error':
        console.error(msg, ...args);
        break;
    }
  }

  debug(module, message, ...args) { this._log('debug', module, message, ...args); }
  info(module, message, ...args) { this._log('info', module, message, ...args); }
  warn(module, message, ...args) { this._log('warn', module, message, ...args); }
  error(module, message, ...args) { this._log('error', module, message, ...args); }
}

const logger = new MeshLogger();
export default logger;
