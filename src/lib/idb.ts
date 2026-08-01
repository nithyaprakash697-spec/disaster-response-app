import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { CitizenReport, PublicAlert, ResourceItem } from '../types';

interface DisasterDB extends DBSchema {
  offline_reports: {
    key: string;
    value: CitizenReport;
  };
  cached_alerts: {
    key: string;
    value: PublicAlert;
  };
  cached_resources: {
    key: string;
    value: ResourceItem;
  };
  last_known_gps: {
    key: string;
    value: {
      key: string;
      lat: number;
      lng: number;
      timestamp: string;
      accuracy?: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<DisasterDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<DisasterDB>('disaster_hub_db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('offline_reports')) {
          db.createObjectStore('offline_reports', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cached_alerts')) {
          db.createObjectStore('cached_alerts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cached_resources')) {
          db.createObjectStore('cached_resources', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('last_known_gps')) {
          db.createObjectStore('last_known_gps', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveOfflineReport(report: CitizenReport): Promise<void> {
  const db = await getDB();
  await db.put('offline_reports', report);
}

export async function getOfflineReports(): Promise<CitizenReport[]> {
  const db = await getDB();
  return await db.getAll('offline_reports');
}

export async function removeOfflineReport(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline_reports', id);
}

export async function clearOfflineReports(): Promise<void> {
  const db = await getDB();
  await db.clear('offline_reports');
}

export async function saveLastKnownGps(lat: number, lng: number, accuracy?: number): Promise<void> {
  const db = await getDB();
  await db.put('last_known_gps', {
    key: 'current_position',
    lat,
    lng,
    timestamp: new Date().toISOString(),
    accuracy,
  });
}

export async function getLastKnownGps(): Promise<{ lat: number; lng: number; timestamp: string; accuracy?: number } | undefined> {
  const db = await getDB();
  return await db.get('last_known_gps', 'current_position');
}

export async function cachePublicAlerts(alerts: PublicAlert[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cached_alerts', 'readwrite');
  await tx.objectStore('cached_alerts').clear();
  for (const alert of alerts) {
    await tx.objectStore('cached_alerts').put(alert);
  }
  await tx.done;
}

export async function getCachedPublicAlerts(): Promise<PublicAlert[]> {
  const db = await getDB();
  return await db.getAll('cached_alerts');
}

export async function cacheResources(resources: ResourceItem[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cached_resources', 'readwrite');
  await tx.objectStore('cached_resources').clear();
  for (const res of resources) {
    await tx.objectStore('cached_resources').put(res);
  }
  await tx.done;
}

export async function getCachedResources(): Promise<ResourceItem[]> {
  const db = await getDB();
  return await db.getAll('cached_resources');
}
