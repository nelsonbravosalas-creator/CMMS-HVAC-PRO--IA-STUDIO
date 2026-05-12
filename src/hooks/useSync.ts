import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { syncData } from '../lib/syncEngine';

export const useSync = () => {
  useEffect(() => {
    const handleOnline = () => syncData();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return { syncData };
};
