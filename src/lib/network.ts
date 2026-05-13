import { logger } from './logger';
import { useSyncStore } from '../store/useSyncStore';
import { useAppStore } from '../store/useAppStore';

class NetworkMonitor {
  private lastPing: number = 0;
  private pingInterval: number = 30000; // 30 seconds

  init() {
    window.addEventListener('online', () => this.handleStatusChange(true));
    window.addEventListener('offline', () => this.handleStatusChange(false));
    
    // Initial check
    this.checkConnection();
    setInterval(() => this.checkConnection(), this.pingInterval);
  }

  private handleStatusChange(isOnline: boolean) {
    logger.info('Network', `Conectividad cambiada: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    useAppStore.getState().setOnline(isOnline);
    useSyncStore.getState().setOnline(isOnline);
  }

  async checkConnection() {
    if (!navigator.onLine) {
      if (useAppStore.getState().isOnline) this.handleStatusChange(false);
      return;
    }

    try {
      const response = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' });
      const isOnline = response.ok;
      
      if (isOnline !== useAppStore.getState().isOnline) {
        this.handleStatusChange(isOnline);
      }
      this.lastPing = Date.now();
    } catch (error) {
      if (useAppStore.getState().isOnline) {
        this.handleStatusChange(false);
      }
    }
  }
}

export const networkMonitor = new NetworkMonitor();
