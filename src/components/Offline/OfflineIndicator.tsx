import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { offlineManager, OfflineTransaction } from '../../lib/offline';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<OfflineTransaction[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsubscribeConnection = offlineManager.onConnectionChange(setIsOnline);
    const unsubscribeSync = offlineManager.onSyncUpdate(setQueue);

    return () => {
      unsubscribeConnection();
      unsubscribeSync();
    };
  }, []);

  const status = offlineManager.getQueueStatus();

  const handleManualSync = async () => {
    setSyncing(true);
    await offlineManager.syncQueue();
    setSyncing(false);
  };

  const handleRetryFailed = () => {
    offlineManager.retryFailed();
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)} h`;
    return `Il y a ${Math.floor(diffMins / 1440)} j`;
  };

  const getOperationLabel = (op: string) => {
    switch (op) {
      case 'insert': return 'Ajout';
      case 'update': return 'Modification';
      case 'delete': return 'Suppression';
      default: return op;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'syncing': return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-orange-600" />;
      default: return null;
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Main Indicator */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg transition-all ${
          isOnline
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-orange-600 hover:bg-orange-700 text-white'
        }`}
      >
        {isOnline ? (
          <Wifi className="w-5 h-5" />
        ) : (
          <WifiOff className="w-5 h-5" />
        )}
        <span className="font-medium">
          {isOnline ? 'En ligne' : 'Mode hors ligne'}
        </span>
        {status.pending > 0 && (
          <span className="px-2 py-1 bg-white bg-opacity-20 rounded text-sm font-bold">
            {status.pending}
          </span>
        )}
      </button>

      {/* Details Panel */}
      {showDetails && (
        <div className="absolute bottom-full right-0 mb-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className={`px-4 py-3 ${isOnline ? 'bg-green-600' : 'bg-orange-600'} text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                <span className="font-semibold">
                  {isOnline ? 'Connexion active' : 'Mode hors ligne'}
                </span>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="hover:bg-white hover:bg-opacity-20 rounded p-1"
              >
                ✕
              </button>
            </div>
            {!isOnline && (
              <p className="text-sm opacity-90 mt-1">
                Les modifications seront synchronisées automatiquement
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div>
                <div className="text-2xl font-bold text-gray-800">{status.total}</div>
                <div className="text-gray-600">Total</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{status.pending}</div>
                <div className="text-gray-600">En attente</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{status.synced}</div>
                <div className="text-gray-600">Synchronisé</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{status.failed}</div>
                <div className="text-gray-600">Échec</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          {(status.pending > 0 || status.failed > 0) && (
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex gap-2">
                {isOnline && status.pending > 0 && (
                  <button
                    onClick={handleManualSync}
                    disabled={syncing || status.isSyncing}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 ${(syncing || status.isSyncing) ? 'animate-spin' : ''}`} />
                    <span className="text-sm font-medium">Synchroniser</span>
                  </button>
                )}
                {status.failed > 0 && (
                  <button
                    onClick={handleRetryFailed}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="text-sm font-medium">Réessayer</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Queue List */}
          <div className="max-h-96 overflow-y-auto">
            {queue.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucune transaction en attente</p>
                <p className="text-xs mt-1">Toutes les données sont synchronisées</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {queue.map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`px-4 py-3 hover:bg-gray-50 ${
                      transaction.status === 'failed' ? 'bg-red-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(transaction.status)}
                          <span className="font-medium text-sm text-gray-900">
                            {getOperationLabel(transaction.operation)} - {transaction.table}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          {formatTimestamp(transaction.timestamp)}
                        </p>
                        {transaction.error && (
                          <p className="text-xs text-red-600 mt-1 line-clamp-2">
                            {transaction.error}
                          </p>
                        )}
                        {transaction.retryCount > 0 && (
                          <p className="text-xs text-orange-600 mt-1">
                            Tentative {transaction.retryCount}/3
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {transaction.status === 'synced' && '✓'}
                        {transaction.status === 'syncing' && '...'}
                        {transaction.status === 'pending' && '⏳'}
                        {transaction.status === 'failed' && '✗'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {status.isSyncing && (
            <div className="px-4 py-2 bg-blue-50 border-t border-blue-200">
              <div className="flex items-center gap-2 text-blue-700 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Synchronisation en cours...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
