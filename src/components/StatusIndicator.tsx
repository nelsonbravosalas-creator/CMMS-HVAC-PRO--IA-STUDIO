import React from 'react';
import { 
  CheckCircle2, 
  Cloud, 
  CloudOff, 
  AlertTriangle, 
  RefreshCw,
  XCircle
} from 'lucide-react';
import { SyncStatus } from '../db/database';

interface StatusIndicatorProps {
  status: SyncStatus;
  size?: number;
  showText?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, size = 16, showText = false }) => {
  const config = {
    synced: {
      icon: <Cloud size={size} className="text-emerald-500" />,
      text: 'Sincronizado',
      color: 'text-emerald-500'
    },
    pending_insert: {
      icon: <RefreshCw size={size} className="text-blue-500 animate-spin" />,
      text: 'Pendiente envío',
      color: 'text-blue-500'
    },
    pending_update: {
      icon: <RefreshCw size={size} className="text-amber-500 animate-spin" />,
      text: 'Actualización pendiente',
      color: 'text-amber-500'
    },
    pending_delete: {
      icon: <CloudOff size={size} className="text-red-500 animate-pulse" />,
      text: 'Eliminación pendiente',
      color: 'text-red-500'
    },
    failed: {
      icon: <AlertTriangle size={size} className="text-red-600" />,
      text: 'Error de sincro',
      color: 'text-red-600'
    },
    conflicted: {
      icon: <XCircle size={size} className="text-purple-500" />,
      text: 'Conflicto',
      color: 'text-purple-500'
    }
  };

  const current = config[status] || config.synced;

  return (
    <div className="flex items-center gap-1.5" title={current.text}>
      {current.icon}
      {showText && <span className={`text-[10px] font-black uppercase tracking-widest ${current.color}`}>{current.text}</span>}
    </div>
  );
};
