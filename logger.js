const fs = require('fs');
const path = require('path');

class Logger {
  constructor(serviceName = 'slag-simulator') {
    this.serviceName = serviceName;
    this.logDir = path.join(__dirname, 'logs');
    this.logLevels = ['error', 'warn', 'info', 'debug', 'trace'];
    this.currentLevel = process.env.LOG_LEVEL || 'info';
    
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    this.logStreams = {};
    this.rotateInterval = null;
    
    this.initLogStreams();
    this.setupLogRotation();
  }
  
  initLogStreams() {
    const logTypes = ['app', 'error', 'access', 'performance'];
    logTypes.forEach(type => {
      const logFile = path.join(this.logDir, `${type}-${this.getDateString()}.log`);
      this.logStreams[type] = fs.createWriteStream(logFile, { flags: 'a' });
    });
  }
  
  getDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  
  setupLogRotation() {
    const checkRotation = () => {
      const today = this.getDateString();
      Object.keys(this.logStreams).forEach(type => {
        const expectedFile = path.join(this.logDir, `${type}-${today}.log`);
        const currentPath = this.logStreams[type].path;
        if (currentPath !== expectedFile) {
          this.logStreams[type].end();
          this.logStreams[type] = fs.createWriteStream(expectedFile, { flags: 'a' });
        }
      });
    };
    
    this.rotateInterval = setInterval(checkRotation, 60 * 60 * 1000);
  }
  
  shouldLog(level) {
    return this.logLevels.indexOf(level) <= this.logLevels.indexOf(this.currentLevel);
  }
  
  format(level, type, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service: this.serviceName,
      type: type,
      message: message,
      pid: process.pid,
      hostname: require('os').hostname(),
      ...data
    };
    return JSON.stringify(logEntry);
  }
  
  write(type, level, message, data) {
    if (!this.shouldLog(level)) return;
    
    const logLine = this.format(level, type, message, data);
    const logStream = this.logStreams[type] || this.logStreams.app;
    
    logStream.write(logLine + '\n');
    
    if (level === 'error' || level === 'warn') {
      console[level === 'error' ? 'error' : 'warn'](
        `[${new Date().toISOString()}] [${level.toUpperCase()}] ${type}: ${message}`
      );
    } else {
      console.log(
        `[${new Date().toISOString()}] [${level.toUpperCase()}] ${type}: ${message}`
      );
    }
  }
  
  info(type, message, data) {
    this.write(type, 'info', message, data);
  }
  
  warn(type, message, data) {
    this.write(type, 'warn', message, data);
  }
  
  error(type, message, data) {
    this.write(type, 'error', message, data);
  }
  
  debug(type, message, data) {
    this.write(type, 'debug', message, data);
  }
  
  access(req, res, duration) {
    const accessLog = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: duration,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      bodySize: res.getHeader('content-length') || 0
    };
    this.write('access', 'info', `${req.method} ${req.url} ${res.statusCode} ${duration}ms`, accessLog);
  }
  
  performance(operation, duration, metrics) {
    const perfLog = {
      operation: operation,
      duration: duration,
      ...metrics
    };
    this.write('performance', 'debug', `Performance: ${operation} took ${duration}ms`, perfLog);
  }
  
  close() {
    if (this.rotateInterval) {
      clearInterval(this.rotateInterval);
    }
    Object.values(this.logStreams).forEach(stream => {
      if (stream && !stream.destroyed) {
        stream.end();
      }
    });
  }
}

module.exports = new Logger();
module.exports.Logger = Logger;
