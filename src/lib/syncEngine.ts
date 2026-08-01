import { CitizenReport } from '../types';
import { getOfflineReports, removeOfflineReport } from './idb';
import { saveCitizenReport } from './supabase';

export const DH_SYNC_EVENT = 'dh-sync-complete';

/**
 * Immediate Sync Engine on Reconnect
 * Automatically flushes queued offline distress reports to Supabase / server
 * with priority sorting (critical/trapped reports sync first).
 */
export async function syncOfflineQueue(): Promise<CitizenReport[]> {
  if (!navigator.onLine) {
    return [];
  }

  try {
    const queued = await getOfflineReports();
    if (queued.length === 0) return [];

    // Sort queue by urgency priority:
    // Critical / Trapped / Medical reports sync first
    const sortedQueue = [...queued].sort((a, b) => {
      const aUrgent = a.needs.includes('Trapped') || a.needs.includes('Medical') || (a.agentExtractedInfo?.urgencyScore || 0) >= 80 ? 2 : 1;
      const bUrgent = b.needs.includes('Trapped') || b.needs.includes('Medical') || (b.agentExtractedInfo?.urgencyScore || 0) >= 80 ? 2 : 1;
      if (aUrgent !== bUrgent) return bUrgent - aUrgent;
      // Secondary sort: oldest event first so first responders get chronological sequence
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    const syncedReports: CitizenReport[] = [];
    const syncTimeIso = new Date().toISOString();

    for (const report of sortedQueue) {
      const updatedReport: CitizenReport = {
        ...report,
        syncedAt: syncTimeIso,
        syncStatus: 'synced',
        isOfflineSubmission: true
      };

      await saveCitizenReport(updatedReport);
      await removeOfflineReport(report.id);
      syncedReports.push(updatedReport);
    }

    // Dispatch global sync completion event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DH_SYNC_EVENT, { detail: { syncedReports, count: syncedReports.length } }));
    }

    return syncedReports;
  } catch (err) {
    console.warn('Sync offline queue warning:', err);
    return [];
  }
}

/**
 * Initializes immediate automatic background sync listener for browser 'online' event.
 */
export function initAutoSyncListener(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => {
    console.log('⚡ Network reconnect detected: Triggering immediate priority offline sync...');
    syncOfflineQueue();
  };

  window.addEventListener('online', handleOnline);

  // Trigger immediate flush if already online
  if (navigator.onLine) {
    syncOfflineQueue();
  }

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}
