import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-14 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-md">
      <WifiOff className="w-3.5 h-3.5 animate-pulse" />
      <span>Sin conexión a internet. Los cambios se sincronizarán al reconectar.</span>
    </div>
  );
};
