import { useSyncStore } from '../store/useSyncStore';
import { logger } from '../lib/logger';

class NetworkMonitor {
  private online: boolean = navigator.onLine;

  init() {
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false));
    useSyncStore.getState().setOnline(this.online);
  }

  isOnline() {
    return this.online;
  }

  private setOnline(status: boolean) {
    if (this.online !== status) {
      this.online = status;
      useSyncStore.getState().setOnline(status);
      logger.info('Network', `Network status changed to ${status ? 'ONLINE' : 'OFFLINE'}`);
      
      if (status) {
        // Broadcast custom event to trigger sync immediately
        window.dispatchEvent(new Event('network-reconnected'));
      }
    }
  }
}

export const networkMonitor = new NetworkMonitor();
