/**
 * Wearable Connect Component
 * Handles connection to health data sources (Apple HealthKit, Google Health Connect)
 */

import React, { useState } from 'react';
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  Smartphone,
  Watch
} from 'lucide-react';
import { useHealthData } from '../hooks/useHealthData';
import { ConnectionState } from '../types/health';
import SyncStatusBadge from './SyncStatusBadge';

interface WearableConnectProps {
  userId: string | undefined;
  onConnect?: (success: boolean) => void;
  onSync?: (data: any) => void;
  className?: string;
}

// Dispositivos compatibles por plataforma
const COMPATIBLE_DEVICES = {
  ios: [
    'Apple Watch',
    'Oura Ring',
    'Fitbit',
    'Garmin',
    'Whoop',
    'Withings'
  ],
  android: [
    'Fitbit',
    'Garmin',
    'Samsung Health',
    'Xiaomi Mi Band',
    'Polar',
    'Withings'
  ]
};

export const WearableConnect: React.FC<WearableConnectProps> = ({
  userId,
  onConnect,
  onSync,
  className = ''
}) => {
  const {
    connectionState,
    connectionStatus,
    healthData,
    isLoading,
    connect,
    disconnect,
    sync,
    reconnect
  } = useHealthData(userId);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConnect = async () => {
    setErrorMessage(null);
    const result = await connect();
    
    if (result.success) {
      onConnect?.(true);
      if (result.data) {
        onSync?.(result.data);
      }
    } else {
      setErrorMessage(result.error || 'Error al conectar');
      onConnect?.(false);
    }
  };

  const handleDisconnect = async () => {
    setErrorMessage(null);
    await disconnect();
    onConnect?.(false);
  };

  const handleSync = async () => {
    setErrorMessage(null);
    const result = await sync();
    
    if (result.success && result.data) {
      onSync?.(result.data);
    } else {
      setErrorMessage(result.error || 'Error al sincronizar');
    }
  };

  const handleReconnect = async () => {
    setErrorMessage(null);
    const success = await reconnect();
    if (success) {
      onConnect?.(true);
    } else {
      setErrorMessage('Error al reconectar');
    }
  };

  const getStateConfig = (state: ConnectionState, platform: string) => {
    switch (state) {
      case 'unavailable':
        return {
          title: 'Conexión de Wearables',
          description: platform === 'web' 
            ? 'La conexión de wearables está disponible en la app móvil (iOS/Android). Descarga la app para sincronizar tus dispositivos automáticamente.'
            : 'Las APIs de salud no están disponibles en este dispositivo. Puedes seguir registrando datos manualmente.',
          showConnect: false,
          showDisconnect: false,
          showSync: false,
          showReconnect: false,
          showCompatibleDevices: true
        };
      case 'disconnected':
        return {
          title: 'Conectar Wearable',
          description: 'Conecta tu Apple Watch, Oura Ring u otro dispositivo compatible para sincronizar datos automáticamente.',
          showConnect: true,
          showDisconnect: false,
          showSync: false,
          showReconnect: false
        };
      case 'connecting':
        return {
          title: 'Conectando...',
          description: 'Solicitando permisos de acceso a datos de salud.',
          showConnect: false,
          showDisconnect: false,
          showSync: false,
          showReconnect: false
        };
      case 'connected':
        return {
          title: 'Conectado',
          description: connectionStatus?.lastSync
            ? `Última sincronización: ${new Date(connectionStatus.lastSync).toLocaleString('es-ES')}`
            : 'Tu wearable está conectado y listo para sincronizar.',
          showConnect: false,
          showDisconnect: true,
          showSync: true,
          showReconnect: false
        };
      case 'syncing':
        return {
          title: 'Sincronizando...',
          description: 'Obteniendo datos de tu wearable.',
          showConnect: false,
          showDisconnect: false,
          showSync: false,
          showReconnect: false
        };
      case 'error_permissions':
        return {
          title: 'Permisos denegados',
          description: 'Necesitamos acceso a tus datos de salud para sincronizar. Por favor, concede los permisos en la configuración de tu dispositivo.',
          showConnect: true,
          showDisconnect: false,
          showSync: false,
          showReconnect: false
        };
      case 'error_sync':
        return {
          title: 'Error de sincronización',
          description: 'No se pudieron obtener datos del wearable. Verifica que tu dispositivo esté sincronizado y vuelve a intentar.',
          showConnect: false,
          showDisconnect: true,
          showSync: true,
          showReconnect: true
        };
      default:
        return {
          title: 'Estado desconocido',
          description: '',
          showConnect: false,
          showDisconnect: false,
          showSync: false,
          showReconnect: false
        };
    }
  };

  const platform = connectionStatus?.platform || 'web';
  const config = getStateConfig(connectionState, platform);

  return (
    <div className={`bg-white rounded-2xl p-6 border border-[#F4F0ED] shadow-sm ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {platform === 'ios' ? (
            <Watch size={24} className="text-[#C7958E]" />
          ) : platform === 'android' ? (
            <Smartphone size={24} className="text-[#C7958E]" />
          ) : (
            <Activity size={24} className="text-[#C7958E]" />
          )}
          <div>
            <h3 className="font-bold text-[#4A4A4A] text-sm">Wearable</h3>
            <p className="text-[10px] text-[#5D7180]">
              {platform === 'ios' ? 'Apple HealthKit' : platform === 'android' ? 'Google Health Connect' : 'No disponible'}
            </p>
          </div>
        </div>
        {connectionState === 'connected' && connectionStatus?.lastSync && (
          <SyncStatusBadge
            status={connectionState}
            lastSync={connectionStatus.lastSync}
          />
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-[#4A4A4A] mb-1">{config.title}</h4>
          <p className="text-xs text-[#5D7180]">{config.description}</p>
        </div>

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-rose-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-rose-700">{errorMessage}</p>
          </div>
        )}

        {connectionStatus?.deviceType && (
          <div className="bg-[#F4F0ED]/50 rounded-xl p-3">
            <p className="text-xs text-[#5D7180] mb-1">Dispositivo conectado:</p>
            <p className="text-sm font-semibold text-[#4A4A4A]">{connectionStatus.deviceType}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {config.showConnect && (
            <button
              onClick={handleConnect}
              disabled={isLoading}
              className="flex-1 bg-[#5D7180] text-white py-2.5 px-4 rounded-xl font-bold text-sm hover:bg-[#4A5568] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Activity size={16} />
              Conectar
            </button>
          )}

          {config.showDisconnect && (
            <button
              onClick={handleDisconnect}
              disabled={isLoading}
              className="flex-1 bg-rose-50 text-rose-600 py-2.5 px-4 rounded-xl font-bold text-sm hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-rose-200"
            >
              <XCircle size={16} />
              Desconectar
            </button>
          )}

          {config.showSync && (
            <button
              onClick={handleSync}
              disabled={isLoading}
              className="flex-1 bg-[#C7958E] text-white py-2.5 px-4 rounded-xl font-bold text-sm hover:bg-[#95706B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Sincronizar ahora
            </button>
          )}

          {config.showReconnect && (
            <button
              onClick={handleReconnect}
              disabled={isLoading}
              className="flex-1 bg-amber-50 text-amber-700 py-2.5 px-4 rounded-xl font-bold text-sm hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-amber-200"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Reconectar
            </button>
          )}
        </div>

        {connectionState === 'connected' && healthData && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-4">
            <p className="text-xs font-semibold text-emerald-800 mb-2">Datos sincronizados:</p>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-emerald-700">
              {healthData.basalBodyTemperature && (
                <div>
                  <span className="font-semibold">Temperatura:</span> {healthData.basalBodyTemperature.toFixed(2)}°C
                </div>
              )}
              {healthData.sleepDurationMinutes && (
                <div>
                  <span className="font-semibold">Sueño:</span> {Math.round(healthData.sleepDurationMinutes / 60)}h
                </div>
              )}
              {healthData.steps && (
                <div>
                  <span className="font-semibold">Pasos:</span> {healthData.steps.toLocaleString()}
                </div>
              )}
              {healthData.heartRateVariability && (
                <div>
                  <span className="font-semibold">HRV:</span> {healthData.heartRateVariability}ms
                </div>
              )}
            </div>
          </div>
        )}

        {config.showCompatibleDevices && (
          <div className="bg-[#F4F0ED]/50 rounded-xl p-4 border border-[#F4F0ED] mt-4">
            <p className="text-xs font-semibold text-[#5D7180] mb-3">
              Dispositivos compatibles:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(platform === 'ios' || platform === 'web' ? COMPATIBLE_DEVICES.ios : COMPATIBLE_DEVICES.android).map((device) => (
                <div key={device} className="text-xs text-[#4A4A4A]">
                  {device}
                </div>
              ))}
            </div>
            {platform === 'web' && (
              <p className="text-[10px] text-[#5D7180] mt-3 italic">
                * Requiere app móvil iOS o Android
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WearableConnect;
