import { ResourceItem } from '../types';

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export function findNearestShelter(
  lat: number,
  lng: number,
  resources: ResourceItem[]
): { shelterName: string; distanceKm: number } {
  const shelters = resources.filter(r => r.type === 'shelter' || r.type === 'hospital');
  if (shelters.length === 0) {
    return { shelterName: 'Nearest Central Emergency Shelter', distanceKm: 2.1 };
  }

  let minDistance = Infinity;
  let nearestName = shelters[0].name;

  for (const shelter of shelters) {
    const dist = calculateDistanceKm(lat, lng, shelter.lat, shelter.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestName = shelter.name;
    }
  }

  return { shelterName: nearestName, distanceKm: minDistance };
}

export function getMinutesAgo(isoTimestamp: string): number {
  const timeMs = new Date(isoTimestamp).getTime();
  const nowMs = Date.now();
  const diffMinutes = Math.floor((nowMs - timeMs) / (1000 * 60));
  return Math.max(0, diffMinutes);
}

export function getTimeGapMinutes(eventIso: string, syncedIso?: string): number {
  if (!syncedIso) return 0;
  const eventTime = new Date(eventIso).getTime();
  const syncTime = new Date(syncedIso).getTime();
  const diffMs = syncTime - eventTime;
  return Math.max(0, Math.floor(diffMs / (1000 * 60)));
}
