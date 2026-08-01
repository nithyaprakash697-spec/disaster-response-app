import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Database, MapPin, CheckCircle2, Clock } from 'lucide-react';
import { CitizenReport } from '../types';
import { getOfflineReports, getLastKnownGps, removeOfflineReport } from '../lib/idb';
import { saveCitizenReport } from '../lib/supabase';

interface Props {
  onSyncComplete?: () => void;
}

export const SyncStatusBadge: React.FC<Props> = ({ onSyncComplete }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingReports, setPendingReports] = useState<CitizenReport[]>([]);
  const [lastGps, setLastGps] = useState<{ lat: number; lng: number; timestamp: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const refreshPending = async () => {
    try {
      const reports = await getOfflineReports();
      setPendingReports(reports);
      const gps = await getLastKnownGps();
      if (gps) setLastGps(gps);
    } catch (e) {
      console.warn('Failed to read IDB:', e);
    }
  };

  useEffect(() => {
    refreshPending();

    const handleOnline = async () => {
      setIsOnline(true);
      await syncAllPending();
    };

    const handleOffline = async () => {
      setIsOnline(false);
      // Auto-capture exact GPS coordinate at offline event moment as specified in requirements
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            const { saveLastKnownGps } = await import('../lib/idb');
            await saveLastKnownGps(latitude, longitude, accuracy);
            const updatedGps = await getLastKnownGps();
            if (updatedGps) setLastGps(updatedGps);
          },
          (err) => console.warn('Offline GPS capture error:', err),
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(refreshPending, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const syncAllPending = async () => {
    if (pendingReports.length === 0) return;
    setIsSyncing(true);
    try {
      for (const rep of pendingReports) {
        await saveCitizenReport(rep);
        await removeOfflineReport(rep.id);
      }
      await refreshPending();
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shadow-sm ${
          !isOnline
            ? 'bg-rose-950/80 border-rose-600 text-rose-300 hover:bg-rose-900/90'
            : isSyncing
            ? 'bg-amber-950/80 border-amber-500 text-amber-300 animate-pulse'
            : pendingReports.length > 0
            ? 'bg-amber-950/80 border-amber-500 text-amber-300'
            : 'bg-emerald-950/80 border-emerald-600 text-emerald-300 hover:bg-emerald-900/90'
        }`}
        title="Click to view offline queue & GPS lock details"
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>Offline ({pendingReports.length} queued)</span>
          </>
        ) : isSyncing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>Syncing Queue...</span>
          </>
        ) : pendingReports.length > 0 ? (
          <>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Online ({pendingReports.length} pending sync)</span>
          </>
        ) : (
          <>
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>Synced</span>
          </>
        )}
      </button>

      {/* Offline Queue Viewer Modal/Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[9990] bg-slate-950/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-red-400" />
                  <h3 className="text-lg font-bold text-white">Offline Queue & GPS Tracker</h3>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="text-slate-400 hover:text-white text-xl font-bold p-1"
                >
                  ✕
                </button>
              </div>

              {/* Network State Summary */}
              <div className="my-4 p-3 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  ) : (
                    <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
                  )}
                  <span className="text-slate-200 font-medium">
                    {isOnline ? 'Network Connection Active' : 'Operating Fully Offline'}
                  </span>
                </div>
                <span className="text-slate-400">PWA IndexedDB</span>
              </div>

              {/* Last Known GPS Lock */}
              {lastGps && (
                <div className="mb-4 p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-300 font-semibold mb-1">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Last Known GPS Coordinate (Auto-captured at Offline Event)</span>
                  </div>
                  <p className="text-slate-300 font-mono text-[11px]">
                    Lat: {lastGps.lat.toFixed(5)}, Lng: {lastGps.lng.toFixed(5)}
                  </p>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    Captured: {new Date(lastGps.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              )}

              {/* Pending Queue List */}
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                  Queued Reports ({pendingReports.length})
                </h4>
                {pendingReports.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 border border-dashed border-slate-800 rounded-lg text-xs">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    No offline reports pending. All distress messages synced to Supabase database.
                  </div>
                ) : (
                  pendingReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="p-3 bg-slate-800/90 border border-slate-700/70 rounded-lg text-xs space-y-1.5"
                    >
                      <div className="flex justify-between items-center text-slate-300 font-medium">
                        <span>{rep.locationName}</span>
                        <span className="bg-amber-900/60 text-amber-300 text-[10px] px-2 py-0.5 rounded border border-amber-700">
                          Pending Sync
                        </span>
                      </div>
                      <p className="text-slate-400 line-clamp-2 italic">"{rep.rawMessage}"</p>
                      <div className="flex gap-1 flex-wrap pt-1">
                        {rep.needs.map((n) => (
                          <span
                            key={n}
                            className="bg-red-950 text-red-300 text-[10px] px-1.5 py-0.5 rounded border border-red-800 font-medium"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer Action */}
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={syncAllPending}
                disabled={!isOnline || pendingReports.length === 0 || isSyncing}
                className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Flushing Queue to Supabase...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span>Force Immediate Sync Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
