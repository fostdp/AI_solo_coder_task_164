class AdaptiveSampler {
  constructor(options = {}) {
    this.minInterval = options.minInterval || 100;
    this.maxInterval = options.maxInterval || 5000;
    this.baseInterval = options.baseInterval || 1000;
    this.currentInterval = this.baseInterval;
    
    this.flowHistory = [];
    this.maxHistorySize = 50;
    
    this.varianceThreshold = options.varianceThreshold || 0.1;
    this.rapidChangeThreshold = options.rapidChangeThreshold || 0.3;
    
    this.lastSampleTime = Date.now();
    this.sampleCount = 0;
  }
  
  updateFlow(flowValue) {
    const now = Date.now();
    this.flowHistory.push({
      value: flowValue,
      timestamp: now
    });
    
    if (this.flowHistory.length > this.maxHistorySize) {
      this.flowHistory.shift();
    }
    
    this.adjustInterval();
  }
  
  adjustInterval() {
    if (this.flowHistory.length < 10) {
      this.currentInterval = this.baseInterval;
      return;
    }
    
    const recentValues = this.flowHistory.slice(-10).map(h => h.value);
    const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentValues.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? stdDev / mean : 0;
    
    const firstValue = recentValues[0];
    const lastValue = recentValues[recentValues.length - 1];
    const changeRate = Math.abs(lastValue - firstValue) / Math.max(firstValue, 1);
    
    if (changeRate > this.rapidChangeThreshold || coefficientOfVariation > this.varianceThreshold * 2) {
      this.currentInterval = Math.max(this.minInterval, this.baseInterval * 0.25);
    } else if (coefficientOfVariation > this.varianceThreshold) {
      this.currentInterval = Math.max(this.minInterval, this.baseInterval * 0.5);
    } else if (coefficientOfVariation < this.varianceThreshold * 0.2) {
      this.currentInterval = Math.min(this.maxInterval, this.baseInterval * 2);
    } else {
      this.currentInterval = this.baseInterval;
    }
  }
  
  shouldSample() {
    const now = Date.now();
    if (now - this.lastSampleTime >= this.currentInterval) {
      this.lastSampleTime = now;
      this.sampleCount++;
      return true;
    }
    return false;
  }
  
  getStatus() {
    return {
      currentInterval: this.currentInterval,
      sampleCount: this.sampleCount,
      historySize: this.flowHistory.length,
      recentVariance: this.flowHistory.length >= 10 ? 
        (() => {
          const recent = this.flowHistory.slice(-10).map(h => h.value);
          const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
          return Math.sqrt(recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length);
        })() : 0
    };
  }
  
  reset() {
    this.flowHistory = [];
    this.currentInterval = this.baseInterval;
    this.lastSampleTime = Date.now();
    this.sampleCount = 0;
  }
}

module.exports = AdaptiveSampler;
