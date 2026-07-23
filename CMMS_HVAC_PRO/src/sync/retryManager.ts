export class RetryManager {
  private maxRetries = 5;
  private baseDelay = 2000;

  getBackoffDelay(retryCount: number): number {
    // Exponential backoff with jitter
    const exponentialResult = this.baseDelay * Math.pow(2, retryCount);
    // Add up to 20% jitter
    const jitter = exponentialResult * 0.2 * Math.random();
    return exponentialResult + jitter;
  }

  shouldRetry(retryCount: number, errorContext?: any): boolean {
    if (retryCount >= this.maxRetries) return false;
    
    // Don't retry client errors that are definitive
    if (errorContext?.status >= 400 && errorContext?.status < 500) {
      if (errorContext.status !== 408 && errorContext.status !== 429) {
        return false;
      }
    }
    
    return true;
  }
}

export const retryManager = new RetryManager();
