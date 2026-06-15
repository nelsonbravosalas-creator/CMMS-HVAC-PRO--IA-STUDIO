import { logger } from './logger';
import { useSyncStore } from '../store/useSyncStore';

export function handleError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(context, message);
  try {
    useSyncStore.getState().addError(`${context}: ${message}`);
  } catch {
    // store may not be initialized yet
  }
}
