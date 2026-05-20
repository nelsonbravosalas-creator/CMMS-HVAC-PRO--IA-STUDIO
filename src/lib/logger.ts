type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  id?: string;
  timestamp: number;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
  source?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 500;
  private persistLevels = new Set<LogLevel>(['warn', 'error']);

  private formatMessage(level: LogLevel, context: string, message: string) {
    return `[${new Date().toISOString()}] [${level.toUpperCase()}] [${context}] ${message}`;
  }

  private addLog(level: LogLevel, context: string, message: string, data?: any) {
    const entry: LogEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      level,
      context,
      message,
      data,
      source: 'frontend'
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) this.logs.pop();

    const formatted = this.formatMessage(level, context, message);
    
    switch (level) {
      case 'info': console.log(formatted, data || ''); break;
      case 'warn': console.warn(formatted, data || ''); break;
      case 'error': console.error(formatted, data || ''); break;
      case 'debug': console.debug(formatted, data || ''); break;
    }

    if (this.persistLevels.has(level)) this.persist(entry);
  }

  private persist(entry: LogEntry) {
    if (typeof window === 'undefined') return;
    const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token') || '';
    if (!token) return;
    fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        ...entry,
        path: window.location.pathname,
        user_agent: window.navigator.userAgent
      })
    }).catch(() => undefined);
  }

  info(context: string, message: string, data?: any) { this.addLog('info', context, message, data); }
  warn(context: string, message: string, data?: any) { this.addLog('warn', context, message, data); }
  error(context: string, message: string, data?: any) { this.addLog('error', context, message, data); }
  debug(context: string, message: string, data?: any) { this.addLog('debug', context, message, data); }

  getLogs() { return this.logs; }
  clearLogs() { this.logs = []; }
  clear() { this.clearLogs(); }
}

export const logger = new Logger();
