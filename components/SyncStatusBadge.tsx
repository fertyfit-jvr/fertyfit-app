/**
 * Sync Status Badge Component
 * Displays the current sync status with visual indicators
 */

import React from 'react';
import { CheckCircle, AlertCircle, Clock, XCircle, Activity } from 'lucide-react';
import { ConnectionState } from '../types/health';

interface SyncStatusBadgeProps {
  status: 'synced' | 'manual' | 'hybrid' | 'error' | ConnectionState;
  lastSync?: Date;
  className?: string;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  status,
  lastSync,
  className = ''
}) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'synced':
      case 'connected':
        return {
          icon: CheckCircle,
          text: 'Sincronizado',
          bgColor: 'bg-emerald-50',
          textColor: 'text-emerald-600',
          borderColor: 'border-emerald-200'
        };
      case 'manual':
      case 'disconnected':
        return {
          icon: Clock,
          text: 'Manual',
          bgColor: 'bg-amber-50',
          textColor: 'text-amber-600',
          borderColor: 'border-amber-200'
        };
      case 'hybrid':
        return {
          icon: Activity,
          text: 'Mixto',
          bgColor: 'bg-blue-50',
          textColor: 'text-blue-600',
          borderColor: 'border-blue-200'
        };
      case 'error':
      case 'error_sync':
      case 'error_permissions':
        return {
          icon: XCircle,
          text: 'Error de sync',
          bgColor: 'bg-rose-50',
          textColor: 'text-rose-600',
          borderColor: 'border-rose-200'
        };
      case 'syncing':
        return {
          icon: Activity,
          text: 'Sincronizando...',
          bgColor: 'bg-indigo-50',
          textColor: 'text-indigo-600',
          borderColor: 'border-indigo-200'
        };
      default:
        return {
          icon: AlertCircle,
          text: 'Desconocido',
          bgColor: 'bg-gray-50',
          textColor: 'text-gray-600',
          borderColor: 'border-gray-200'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatLastSync = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Hace un momento';
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor} ${className}`}
    >
      <Icon size={14} className="flex-shrink-0" />
      <span className="text-xs font-medium">{config.text}</span>
      {lastSync && status !== 'syncing' && (
        <span className="text-[10px] opacity-70">
          {formatLastSync(lastSync)}
        </span>
      )}
    </div>
  );
};

export default SyncStatusBadge;

