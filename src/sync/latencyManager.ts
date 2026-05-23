export class LatencyManager {
  private baseLatency = 500; // start with assumption of 500ms
  private measurements: number[] = [];
  
  recordLatency(ms: number) {
    this.measurements.push(ms);
    if (this.measurements.length > 10) {
      this.measurements.shift();
    }
  }

  getAverageLatency(): number {
    if (this.measurements.length === 0) return this.baseLatency;
    return this.measurements.reduce((a, b) => a + b, 0) / this.measurements.length;
  }

  isHighLatency(): boolean {
    return this.getAverageLatency() > 1500; // Over 1.5s is high latency
  }

  getTimeoutForRequest(): number {
    // Return a dynamically calculated timeout based on average latency
    const avg = this.getAverageLatency();
    return Math.max(10000, avg * 3); // minimum 10s timeout, or 3c average
  }
}

export const latencyManager = new LatencyManager();
