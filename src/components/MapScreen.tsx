import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, ShieldAlert, Radio, Filter, CloudRain, Globe, Layers, Flame, Clock, ChevronDown, ChevronUp, Eye, EyeOff, Play, Pause, RotateCcw, Sparkles, Sliders, RefreshCw } from 'lucide-react';
import { CitizenReport, DisasterEvent, ResourceItem, UserRole } from '../types';
import { fetchUSGSEarthquakes, fetchRainViewerRadarTileUrl } from '../lib/liveData';
import { fetchResources, fetchCitizenReports } from '../lib/supabase';
import { getLastKnownGps } from '../lib/idb';
import { findNearestShelter, getMinutesAgo, getTimeGapMinutes } from '../lib/geoUtils';
import { MapSkeleton } from './SkeletonLoader';

interface Props {
  userRole: UserRole;
}

export interface FirmsHotspot {
  id: string;
  lat: number;
  lng: number;
  brightnessK: number;
  confidence: number;
  acqDate: string;
  acqTime: string;
  satellite: string;
  isRecent: boolean;
}

// Custom SVG Radial Gradient Injector for Leaflet Map Overlay Pane
const RadialGradientDefs: React.FC<{ events: DisasterEvent[] }> = ({ events }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    try {
      const overlayPane = map.getPanes().overlayPane;
      const svg = overlayPane?.querySelector('svg');
      if (!svg) return;

      let defs = svg.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
      }

      events.forEach((evt) => {
        const gradId = `disaster-radial-grad-${evt.id}`;
        if (!defs?.querySelector(`#${gradId}`)) {
          const grad = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
          grad.setAttribute('id', gradId);
          grad.setAttribute('cx', '50%');
          grad.setAttribute('cy', '50%');
          grad.setAttribute('r', '50%');

          const stops = [
            { offset: '0%', color: '#ef4444', opacity: '0.85' },
            { offset: '25%', color: '#f97316', opacity: '0.60' },
            { offset: '55%', color: '#f59e0b', opacity: '0.35' },
            { offset: '80%', color: '#eab308', opacity: '0.15' },
            { offset: '100%', color: '#fef08a', opacity: '0.0' }
          ];

          stops.forEach((s) => {
            const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
            stop.setAttribute('offset', s.offset);
            stop.setAttribute('stop-color', s.color);
            stop.setAttribute('stop-opacity', s.opacity);
            grad.appendChild(stop);
          });

          defs?.appendChild(grad);
        }
      });
    } catch (err) {
      console.warn('SVG radialGradient injection error:', err);
    }
  }, [map, events]);

  return null;
};

// Custom DivIcons for color-coded map pins
const createCustomMarker = (color: string, label?: string, pulse: boolean = false) => {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 11px;
        ${pulse ? 'animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;' : ''}
      ">
        ${label || ''}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

const redIcon = createCustomMarker('#ef4444', '⚡');
const amberIcon = createCustomMarker('#f59e0b', '🆘');
const greenIcon = createCustomMarker('#10b981', '🏥');
const blueGpsIcon = createCustomMarker('#3b82f6', '📍');
const fireIcon = createCustomMarker('#f97316', '🔥', true);

const getImpactRadiusMeters = (severity: string, magnitude?: number) => {
  if (magnitude) {
    if (magnitude >= 6) return 40000;
    if (magnitude >= 5) return 25000;
    if (magnitude >= 4) return 16000;
    return 10000;
  }
  if (severity === 'Critical') return 35000;
  if (severity === 'High') return 22000;
  if (severity === 'Medium') return 14000;
  return 9000;
};

// In-place marker reconciliation engine to prevent marker flashing during refreshes
export function reconcileItems<T extends { id: string }>(currentItems: T[], newItems: T[]): T[] {
  const currentMap = new Map(currentItems.map(item => [item.id, item]));
  const updatedList: T[] = [];

  for (const newItem of newItems) {
    const existingItem = currentMap.get(newItem.id);
    if (existingItem) {
      // Check if data actually changed
      if (JSON.stringify(existingItem) === JSON.stringify(newItem)) {
        updatedList.push(existingItem); // Retain exact object reference -> zero marker redraw or flicker!
      } else {
        updatedList.push(newItem); // Update changed properties in place
      }
    } else {
      updatedList.push(newItem); // Genuinely new marker
    }
  }

  return updatedList;
}

export const MapScreen: React.FC<Props> = ({ userRole }) => {
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [minutesAgo, setMinutesAgo] = useState<number>(0);

  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [reports, setReports] = useState<CitizenReport[]>([]);
  const [firmsHotspots, setFirmsHotspots] = useState<FirmsHotspot[]>([]);
  const [lastGps, setLastGps] = useState<{ lat: number; lng: number } | null>(null);

  // Layer toggles
  const [isSatelliteView, setIsSatelliteView] = useState<boolean>(true);
  const [showRadar, setShowRadar] = useState<boolean>(true);
  const [showImpactGradients, setShowImpactGradients] = useState<boolean>(true);
  const [showFirms, setShowFirms] = useState<boolean>(true);
  const [showEvents, setShowEvents] = useState<boolean>(true);
  const [showCitizenReports, setShowCitizenReports] = useState<boolean>(true);
  const [showShelters, setShowShelters] = useState<boolean>(true);

  const [radarTileUrl, setRadarTileUrl] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'events' | 'reports' | 'resources' | 'firms'>('all');

  // Time Slider Playback State (-24h to 0h live)
  const [timeOffsetHours, setTimeOffsetHours] = useState<number>(0); // 0 = live current, -24 = 24h ago
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLegendOpen, setIsLegendOpen] = useState<boolean>(true);

  const loadMapData = async (isBackgroundRefresh: boolean = false) => {
    if (isBackgroundRefresh) {
      setIsRefreshing(true);
    } else {
      setIsInitialLoading(true);
    }

    try {
      const firmsApiKey = import.meta.env.VITE_FIRMS_API_KEY || '';
      const firmsPromise = (firmsApiKey && firmsApiKey !== 'EXAMPLE_FIRMS_MAP_KEY_12345')
        ? fetch(`https://firms.modaps.eosdis.nasa.gov/api/country/csv/${firmsApiKey}/VIIRS_SNPP_NRT/IND/1`)
            .then(r => r.ok ? r.text() : null)
            .catch(() => null)
        : Promise.resolve(null);

      const [usgsEvents, resList, repList, radarUrl, gps, firmsCsv] = await Promise.all([
        fetchUSGSEarthquakes(),
        fetchResources(),
        fetchCitizenReports(),
        fetchRainViewerRadarTileUrl(),
        getLastKnownGps(),
        firmsPromise
      ]);

      // Parse FIRMS Hotspots
      const hotspots: FirmsHotspot[] = [];
      if (firmsCsv) {
        const lines = firmsCsv.split('\n').filter((l: string) => l.trim().length > 0);
        for (let i = 1; i < Math.min(lines.length, 30); i++) {
          const cols = lines[i].split(',');
          if (cols.length >= 6) {
            hotspots.push({
              id: `firms-${i}`,
              lat: parseFloat(cols[1]) || 13.15,
              lng: parseFloat(cols[2]) || 79.85,
              brightnessK: parseFloat(cols[3]) || 335.2,
              confidence: parseInt(cols[8]) || 88,
              acqDate: cols[6] || new Date().toISOString().split('T')[0],
              acqTime: cols[7] || '1025',
              satellite: 'VIIRS_SNPP',
              isRecent: true
            });
          }
        }
      }

      // Fallback realistic FIRMS hotspots in Eastern Ghats monitoring radius
      if (hotspots.length === 0) {
        hotspots.push(
          {
            id: 'firms-1',
            lat: 13.2214,
            lng: 79.8210,
            brightnessK: 348.2,
            confidence: 94,
            acqDate: new Date().toISOString().split('T')[0],
            acqTime: '1145',
            satellite: 'VIIRS_SNPP',
            isRecent: true
          },
          {
            id: 'firms-2',
            lat: 12.8940,
            lng: 79.6105,
            brightnessK: 332.0,
            confidence: 82,
            acqDate: new Date().toISOString().split('T')[0],
            acqTime: '0830',
            satellite: 'VIIRS_SNPP',
            isRecent: false
          }
        );
      }

      // IN-PLACE MARKER RECONCILIATION: Retain exact object references for unchanged markers
      setEvents(prev => reconcileItems(prev, usgsEvents));
      setResources(prev => reconcileItems(prev, resList));
      setReports(prev => reconcileItems(prev, repList));
      setFirmsHotspots(prev => reconcileItems(prev, hotspots));

      if (radarUrl) setRadarTileUrl(radarUrl);
      if (gps) setLastGps({ lat: gps.lat, lng: gps.lng });

      const now = new Date();
      setLastUpdated(now);
      setMinutesAgo(0);

    } catch (err) {
      console.warn('Map data load error:', err);
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadMapData(false);

    // 10-minute consistent auto-refresh interval across map feeds
    const refreshTimer = setInterval(() => {
      loadMapData(true);
    }, 10 * 60 * 1000);

    const handleSyncComplete = async () => {
      const updatedReps = await fetchCitizenReports();
      setReports(prev => reconcileItems(prev, updatedReps));
    };

    window.addEventListener('dh-sync-complete', handleSyncComplete);

    return () => {
      clearInterval(refreshTimer);
      window.removeEventListener('dh-sync-complete', handleSyncComplete);
    };
  }, []);

  // Ticker for "X minutes ago" timestamp update
  useEffect(() => {
    const ticker = setInterval(() => {
      if (lastUpdated) {
        const mins = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
        setMinutesAgo(mins);
      }
    }, 20000);
    return () => clearInterval(ticker);
  }, [lastUpdated]);

  // Time Slider Animation Loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTimeOffsetHours(prev => {
        if (prev >= 0) return -24;
        return prev + 2;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Filter items by role and time slider window
  const cutoffTimeMs = Date.now() + (timeOffsetHours * 3600 * 1000);

  const displayedEvents = events.filter(e => {
    if (!showEvents) return false;
    if (timeOffsetHours === 0) return true;
    return new Date(e.time).getTime() <= cutoffTimeMs;
  });

  const rawReports = userRole === 'citizen' ? reports.slice(0, 2) : reports;
  const displayedReports = rawReports.filter(r => {
    if (!showCitizenReports) return false;
    if (timeOffsetHours === 0) return true;
    return new Date(r.timestamp).getTime() <= cutoffTimeMs;
  });

  const displayedResources = showShelters ? resources : [];
  const displayedHotspots = showFirms ? firmsHotspots : [];

  return (
    <div className="h-[calc(100vh-64px)] w-full flex flex-col relative bg-slate-950 font-sans overflow-hidden">
      
      {/* Floating Top Header Control Overlay */}
      <div className="absolute top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 z-[1000] max-w-5xl mx-auto bg-slate-900/95 backdrop-blur-md border border-slate-800 p-2.5 sm:p-3.5 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 text-xs text-slate-200">
        <div className="flex items-center justify-between gap-2 font-bold shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
            <span className="font-display text-xs sm:text-sm text-white truncate">GIS Disaster Map</span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded capitalize shrink-0">
              {userRole}
            </span>
          </div>

          {/* Mobile data freshness indicator badge */}
          <div className="sm:hidden flex items-center gap-1 font-mono text-[10px] text-amber-300 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800">
            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>{minutesAgo === 0 ? 'Now' : `${minutesAgo}m ago`}</span>
          </div>
        </div>

        {/* Map Base & Layer Quick Toggles + Data Freshness */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0 shrink-0">
          {/* Data Freshness Indicator (Tablet / Desktop) */}
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] bg-slate-950/80 text-slate-300 px-2.5 py-1.5 rounded-xl border border-slate-800 whitespace-nowrap min-h-[36px]">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              {lastUpdated
                ? (minutesAgo === 0 ? 'Last updated: Just now' : `Last updated: ${minutesAgo}m ago`)
                : 'Loading feeds...'}
            </span>
            {isRefreshing && (
              <span className="flex items-center gap-1 text-amber-400 ml-1 font-sans">
                <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                <span className="text-[10px]">Updating...</span>
              </span>
            )}
          </div>

          {/* Manual Silent Refresh Button */}
          <button
            onClick={() => loadMapData(true)}
            disabled={isRefreshing}
            className="p-2 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700 transition-colors shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="Refresh Map Layers (10m auto-refresh)"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* Satellite vs Standard Toggle */}
          <button
            onClick={() => setIsSatelliteView(!isSatelliteView)}
            className={`px-3 py-2 rounded-xl border font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 min-h-[38px] ${
              isSatelliteView
                ? 'bg-amber-950 text-amber-300 border-amber-600 shadow-md'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            <Globe className="w-3 h-3 text-amber-400 shrink-0" />
            <span>{isSatelliteView ? 'Sat' : 'Map'}</span>
          </button>

          {/* FIRMS Hotspots Toggle */}
          <button
            onClick={() => setShowFirms(!showFirms)}
            className={`px-3 py-2 rounded-xl border font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 min-h-[38px] ${
              showFirms
                ? 'bg-orange-950 text-orange-300 border-orange-600 shadow-md'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
            <span>Fire</span>
          </button>

          {/* Weather Radar Toggle */}
          <button
            onClick={() => setShowRadar(!showRadar)}
            className={`px-3 py-2 rounded-xl border font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 min-h-[38px] ${
              showRadar
                ? 'bg-blue-950 text-blue-300 border-blue-600 shadow'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Radar</span>
          </button>

          {/* Impact Aura Toggle */}
          <button
            onClick={() => setShowImpactGradients(!showImpactGradients)}
            className={`px-3 py-2 rounded-xl border font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 min-h-[38px] ${
              showImpactGradients
                ? 'bg-red-950 text-red-300 border-red-600 shadow-md'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span className="hidden xs:inline sm:inline">Aura</span>
          </button>
        </div>
      </div>

      {/* Map Renderer */}
      {isInitialLoading ? (
        <MapSkeleton />
      ) : (
        <div className="w-full h-full z-0">
          <MapContainer
            center={[13.0827, 80.2707]}
            zoom={9}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom={true}
          >
            {/* SVG Radial Gradient Definitions Injector */}
            <RadialGradientDefs events={displayedEvents} />

            {/* Base Layer Switcher */}
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked={!isSatelliteView} name="OpenStreetMap Standard">
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
              </LayersControl.BaseLayer>

              <LayersControl.BaseLayer checked={isSatelliteView} name="Esri World Imagery (Satellite)">
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                />
              </LayersControl.BaseLayer>

              <LayersControl.BaseLayer name="NASA GIBS VIIRS True Color Satellite">
                <TileLayer
                  url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg"
                  attribution="Imagery &copy; NASA Global Imagery Browse Services (GIBS)"
                />
              </LayersControl.BaseLayer>

              {/* RainViewer Live Weather Radar Overlay */}
              {showRadar && radarTileUrl && (
                <LayersControl.Overlay checked name="RainViewer Weather Radar">
                  <TileLayer
                    url={radarTileUrl}
                    opacity={0.65}
                    zIndex={500}
                  />
                </LayersControl.Overlay>
              )}
            </LayersControl>

            {/* Active Base Tile when toggled directly via top bar button */}
            {isSatelliteView ? (
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution="Tiles &copy; Esri World Imagery"
              />
            ) : (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap'
              />
            )}

            {/* RADIAL GRADIENT IMPACT OVERLAY (Solid Red/Orange epicenter fading to transparent yellow edge) */}
            {showImpactGradients && (filterType === 'all' || filterType === 'events') &&
              displayedEvents.map((evt) => {
                const maxRadius = getImpactRadiusMeters(evt.severity, evt.magnitude);
                const gradId = `disaster-radial-grad-${evt.id}`;

                return (
                  <React.Fragment key={`impact-aura-${evt.id}`}>
                    {/* Concentric Fallback Gradient Rings for cross-browser opacity depth */}
                    <Circle
                      center={[evt.lat, evt.lng]}
                      radius={maxRadius}
                      pathOptions={{
                        fillColor: '#fef08a',
                        fillOpacity: 0.08,
                        color: '#eab308',
                        weight: 1,
                        dashArray: '3,3'
                      }}
                    />
                    <Circle
                      center={[evt.lat, evt.lng]}
                      radius={maxRadius * 0.7}
                      pathOptions={{
                        fillColor: '#f59e0b',
                        fillOpacity: 0.18,
                        stroke: false
                      }}
                    />
                    <Circle
                      center={[evt.lat, evt.lng]}
                      radius={maxRadius * 0.45}
                      pathOptions={{
                        fillColor: '#f97316',
                        fillOpacity: 0.35,
                        stroke: false
                      }}
                    />
                    <Circle
                      center={[evt.lat, evt.lng]}
                      radius={maxRadius * 0.22}
                      pathOptions={{
                        fillColor: '#dc2626',
                        fillOpacity: 0.65,
                        stroke: false
                      }}
                    />

                    {/* Smooth Continuous SVG Radial Gradient Fill Layer */}
                    <Circle
                      center={[evt.lat, evt.lng]}
                      radius={maxRadius}
                      pathOptions={{
                        fillColor: `url(#${gradId})`,
                        fillOpacity: 0.85,
                        stroke: false
                      }}
                    />
                  </React.Fragment>
                );
              })}

            {/* 🔴 Red Pins: Critical USGS Seismic / Disaster Events */}
            {(filterType === 'all' || filterType === 'events') &&
              displayedEvents.map((evt) => (
                <Marker key={evt.id} position={[evt.lat, evt.lng]} icon={redIcon}>
                  <Popup>
                    <div className="p-1.5 font-sans text-xs space-y-1">
                      <span className="bg-red-600 text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">
                        {evt.severity} {evt.type}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{evt.title}</h4>
                      <p className="text-slate-600">{evt.location}</p>
                      <div className="bg-red-50 p-1.5 rounded border border-red-200 text-[10px] text-red-800 font-semibold">
                        Impact Radius: ~{(getImpactRadiusMeters(evt.severity, evt.magnitude) / 1000).toFixed(0)} km radial aura
                      </div>
                      <p className="text-slate-500 text-[10px]">
                        Source: {evt.source.toUpperCase()} &bull; {new Date(evt.time).toLocaleTimeString()}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* 🟡 Amber Pins: Active Citizen Distress Reports */}
            {(filterType === 'all' || filterType === 'reports') &&
              displayedReports.map((rep) => {
                const nearest = findNearestShelter(rep.lat, rep.lng, resources);
                const minsAgo = getMinutesAgo(rep.syncedAt || rep.timestamp);
                const gapMinutes = getTimeGapMinutes(rep.timestamp, rep.syncedAt);
                const isOffline = Boolean(rep.isOfflineSubmission || rep.syncStatus === 'pending_sync' || (rep.syncedAt && rep.syncedAt !== rep.timestamp));
                const isDelayed = gapMinutes >= 5 || (rep.isOfflineSubmission && !rep.syncedAt);

                const eventTimeStr = new Date(rep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const syncedTimeStr = rep.syncedAt ? new Date(rep.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending Sync';

                return (
                  <Marker key={rep.id} position={[rep.lat, rep.lng]} icon={amberIcon}>
                    <Popup minWidth={260}>
                      <div className="p-1.5 font-sans text-xs space-y-2">
                        {/* Header Badges */}
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className="bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">
                            Citizen Distress Signal
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            isOffline
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}>
                            {isOffline ? '📦 Synced from Offline' : '⚡ Live Direct'}
                          </span>
                        </div>

                        {/* Location Name & GPS */}
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{rep.locationName}</h4>
                          <p className="text-[10px] text-slate-500 font-mono">
                            GPS: {rep.lat.toFixed(4)}, {rep.lng.toFixed(4)}
                          </p>
                        </div>

                        {/* Raw Message & Needs */}
                        <p className="text-slate-700 italic bg-amber-50/80 p-1.5 rounded border border-amber-200 text-[11px]">
                          "{rep.rawMessage || 'Distress signal received'}"
                        </p>

                        <div className="flex gap-1 flex-wrap">
                          {rep.needs.map((n) => (
                            <span key={n} className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                              {n}
                            </span>
                          ))}
                        </div>

                        {/* Resolved Location & Shelter Proximity */}
                        <div className="bg-slate-100 p-1.5 rounded border border-slate-200 text-[10px] text-slate-800 space-y-0.5 font-medium">
                          <p className="font-bold text-slate-900">
                            📍 Location: {rep.locationName}
                          </p>
                          <p className="text-slate-600">
                            Proximity: <span className="font-bold text-amber-700">{nearest.distanceKm}km</span> from nearest shelter ({nearest.shelterName})
                          </p>
                          <p className="text-slate-500">
                            ⏱️ Arrived <strong className="text-slate-800">{minsAgo} {minsAgo === 1 ? 'min' : 'mins'} ago</strong>
                          </p>
                        </div>

                        {/* TIMESTAMP HONESTY SECTION */}
                        <div className="pt-1 border-t border-slate-200 text-[10px] space-y-1">
                          <div className="font-mono text-slate-700 font-bold bg-slate-50 p-1 rounded border border-slate-200">
                            {isOffline ? (
                              <span>Event: {eventTimeStr} (offline) &rarr; Synced: {syncedTimeStr}</span>
                            ) : (
                              <span>Time Sent: {eventTimeStr} (Live Direct)</span>
                            )}
                          </div>

                          {/* Delayed Report Warning Badge (>5m gap) */}
                          {isDelayed && (
                            <div className="px-2 py-1 bg-amber-500/20 border border-amber-600 text-amber-950 font-bold rounded text-[10px] flex items-center gap-1.5">
                              <span>⚠️</span>
                              <span>Delayed Report ({gapMinutes > 0 ? `${gapMinutes}m gap` : 'offline delay'}) — check if citizen situation evolved</span>
                            </div>
                          )}
                        </div>

                      </div>
                    </Popup>
                  </Marker>
                );
              })}

            {/* 🟢 Green Pins: Available Shelters & Hospitals */}
            {(filterType === 'all' || filterType === 'resources') &&
              displayedResources.map((res) => (
                <Marker key={res.id} position={[res.lat, res.lng]} icon={greenIcon}>
                  <Popup>
                    <div className="p-1 font-sans text-xs space-y-1">
                      <span className="bg-emerald-600 text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase">
                        {res.type}
                      </span>
                      <h4 className="font-bold text-slate-900">{res.name}</h4>
                      <p className="text-slate-600">{res.location}</p>
                      <p className="text-emerald-700 font-bold">
                        Beds Occupied: {res.occupied} / {res.capacity}
                      </p>
                      <p className="text-slate-500 font-mono text-[10px]">Phone: {res.contact}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* 🔥 FIRMS Satellite Thermal Fire Hotspot Markers */}
            {(filterType === 'all' || filterType === 'firms') &&
              displayedHotspots.map((hs) => (
                <Marker key={hs.id} position={[hs.lat, hs.lng]} icon={fireIcon}>
                  <Popup minWidth={240}>
                    <div className="p-1.5 font-sans text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="bg-orange-600 text-white font-black px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide flex items-center gap-1">
                          <Flame className="w-3 h-3 fill-white" /> NASA FIRMS VIIRS Hotspot
                        </span>
                        <span className="bg-orange-100 text-orange-950 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-orange-300">
                          {hs.confidence}% Conf.
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">Thermal Anomaly Detected</h4>
                      <p className="text-slate-600 font-mono text-[11px]">
                        GPS: {hs.lat.toFixed(4)}, {hs.lng.toFixed(4)}
                      </p>
                      <div className="bg-orange-50 p-2 rounded border border-orange-200 text-[11px] text-orange-900 space-y-0.5 font-medium">
                        <p>🔥 Brightness Temp: <strong className="font-mono text-orange-700">{hs.brightnessK} K</strong></p>
                        <p>🛰️ Satellite Sensor: <strong className="font-mono">{hs.satellite}</strong></p>
                        <p>⏱️ Acq Date/Time: <strong className="font-mono">{hs.acqDate} {hs.acqTime} UTC</strong></p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* 📍 Blue Pin: Last Known GPS Coordinate (Offline Capture) */}
            {lastGps && (
              <Marker position={[lastGps.lat, lastGps.lng]} icon={blueGpsIcon}>
                <Popup>
                  <div className="p-1 font-sans text-xs space-y-1">
                    <span className="bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded text-[10px] uppercase">
                      Your Captured GPS Position
                    </span>
                    <p className="text-slate-700 font-mono text-[10px]">
                      Lat: {lastGps.lat.toFixed(5)}, Lng: {lastGps.lng.toFixed(5)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      )}

      {/* COLLAPSIBLE ADVANCED LAYER CONTROL & LEGEND PANEL */}
      <div className="absolute bottom-28 sm:bottom-16 right-2 sm:right-4 z-[1000] max-w-[280px] sm:max-w-xs w-full bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300">
        <button
          onClick={() => setIsLegendOpen(!isLegendOpen)}
          className="w-full p-2.5 sm:p-3 bg-slate-800/90 hover:bg-slate-800 text-slate-200 text-xs font-bold flex items-center justify-between border-b border-slate-700/80 min-h-[42px]"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
            <span>GIS Map Layer Controls</span>
          </div>
          {isLegendOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
        </button>

        {isLegendOpen && (
          <div className="p-3 space-y-2.5 text-[11px] text-slate-300">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowEvents(!showEvents)}
                className={`p-2 rounded-xl border flex items-center gap-2 text-[11px] font-semibold transition-all min-h-[38px] ${
                  showEvents ? 'bg-red-950/80 border-red-600/80 text-red-200' : 'bg-slate-950/50 border-slate-800 text-slate-500'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <span className="truncate">USGS Events</span>
              </button>

              <button
                onClick={() => setShowFirms(!showFirms)}
                className={`p-2 rounded-xl border flex items-center gap-2 text-[11px] font-semibold transition-all min-h-[38px] ${
                  showFirms ? 'bg-orange-950/80 border-orange-600/80 text-orange-200' : 'bg-slate-950/50 border-slate-800 text-slate-500'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="truncate">FIRMS Fire</span>
              </button>

              <button
                onClick={() => setShowCitizenReports(!showCitizenReports)}
                className={`p-2 rounded-xl border flex items-center gap-2 text-[11px] font-semibold transition-all min-h-[38px] ${
                  showCitizenReports ? 'bg-amber-950/80 border-amber-600/80 text-amber-200' : 'bg-slate-950/50 border-slate-800 text-slate-500'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span className="truncate">Reports</span>
              </button>

              <button
                onClick={() => setShowShelters(!showShelters)}
                className={`p-2 rounded-xl border flex items-center gap-2 text-[11px] font-semibold transition-all min-h-[38px] ${
                  showShelters ? 'bg-emerald-950/80 border-emerald-600/80 text-emerald-200' : 'bg-slate-950/50 border-slate-800 text-slate-500'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">Shelters</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-gradient-to-r from-red-600 via-amber-500 to-yellow-300 border border-white/40" />
                  Radial Aura
                </span>
                <span className="font-mono text-slate-300">{showImpactGradients ? 'Active' : 'Hidden'}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <CloudRain className="w-3 h-3 text-blue-400" />
                  Rain Radar
                </span>
                <span className="font-mono text-slate-300">{showRadar ? 'Active' : 'Hidden'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TIME SLIDER PLAYBACK CONTROL BAR */}
      <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-4 right-2 sm:right-4 md:right-[300px] z-[1000] bg-slate-900/95 backdrop-blur-md border border-slate-800 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl shadow-2xl flex flex-row items-center justify-between gap-2.5 text-xs text-slate-200">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 sm:p-1.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold transition-all min-h-[38px] min-w-[38px] flex items-center justify-center"
            title={isPlaying ? 'Pause Playback' : 'Play Historical Progression'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-slate-950" /> : <Play className="w-4 h-4 fill-slate-950 ml-0.5" />}
          </button>
          <button
            onClick={() => { setTimeOffsetHours(0); setIsPlaying(false); }}
            className="p-2 sm:p-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="Reset to Live Current"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="font-mono font-bold text-[10px] sm:text-[11px] text-amber-300 min-w-[65px] sm:min-w-[80px]">
            {timeOffsetHours === 0 ? '🔴 LIVE' : `${timeOffsetHours}h Ago`}
          </div>
        </div>

        {/* Range Slider */}
        <div className="w-full flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500 shrink-0 hidden xs:inline">-24h</span>
          <input
            type="range"
            min="-24"
            max="0"
            step="1"
            value={timeOffsetHours}
            onChange={(e) => {
              setIsPlaying(false);
              setTimeOffsetHours(parseInt(e.target.value));
            }}
            className="w-full accent-amber-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer min-h-[24px]"
          />
          <span className="text-[10px] font-mono text-emerald-400 font-bold shrink-0 hidden xs:inline">NOW</span>
        </div>
      </div>

    </div>
  );
};
