// Debug logger that sends logs to both console and file
class DebugLogger {
  private static instance: DebugLogger;
  private queue: any[] = [];
  private isProcessing = false;

  private constructor() {}

  static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  async log(type: string, message: string, data?: any) {
    // Always log to console
    console.log(`[${type}] ${message}`, data || '');
    
    // Add to queue for file logging
    this.queue.push({ type, message, data, timestamp: new Date().toISOString() });
    
    // Process queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift();

    try {
      await fetch('/api/debug-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
    } catch (error) {
      console.error('Failed to send log to file:', error);
    }

    // Process next item
    setTimeout(() => this.processQueue(), 100);
  }

  async clear() {
    try {
      await fetch('/api/debug-log', { method: 'DELETE' });
      console.log('Debug log cleared');
    } catch (error) {
      console.error('Failed to clear debug log:', error);
    }
  }
}

export const debugLog = DebugLogger.getInstance();

// Convenience methods
export const logClient = (message: string, data?: any) => 
  debugLog.log('CLIENT', message, data);

export const logError = (message: string, error: any) => 
  debugLog.log('ERROR', message, {
    message: error?.message,
    stack: error?.stack,
    data: error?.data,
  });

export const logAI = (message: string, data?: any) => 
  debugLog.log('AI', message, data);

export const logConvex = (message: string, data?: any) => 
  debugLog.log('CONVEX', message, data);