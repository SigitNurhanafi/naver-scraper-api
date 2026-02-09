// src/utils/metrics.ts
export class MetricsService {
  private stats = {
    totalRequests: 0,
    successCount: 0,
    errorCount: 0,
    totalLatency: 0,
    startTime: Date.now()
  };
  
  recordSuccess(latency: number) {
    this.stats.totalRequests++;
    this.stats.successCount++;
    this.stats.totalLatency += latency;
  }
  
  recordError() {
    this.stats.totalRequests++;
    this.stats.errorCount++;
  }
  
  getStats() {
    const avgLatency = this.stats.totalLatency / this.stats.successCount;
    const errorRate = (this.stats.errorCount / this.stats.totalRequests) * 100;
    const uptime = Date.now() - this.stats.startTime;
    
    return { avgLatency, errorRate, uptime, ...this.stats };
  }
}