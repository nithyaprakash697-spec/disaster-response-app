import React from 'react';
import { ShieldAlert, Bot, Radio, Wifi, Zap, Users, ArrowRight, Activity, MapPin, Sparkles } from 'lucide-react';

interface Props {
  onOpenAuth: () => void;
  onExploreMap: () => void;
}

export const LandingHero: React.FC<Props> = ({ onOpenAuth, onExploreMap }) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* SECTION 1: HERO */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-hidden">
        
        {/* Glow ambient background graphics */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-red-600/20 via-amber-500/10 to-blue-600/20 rounded-full blur-[120px] pointer-events-none -z-10"></div>

        <div className="text-center max-w-4xl mx-auto space-y-6">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-red-400 font-semibold shadow-inner">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Next-Generation Autonomous Disaster Intelligence Network</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.1] font-display">
            Multi-Agent AI for Real-Time <br />
            <span className="bg-gradient-to-r from-red-500 via-amber-400 to-orange-500 bg-clip-text text-transparent">
              Disaster Management & Emergency Response
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 font-normal max-w-2xl mx-auto leading-relaxed">
            Coordinating autonomous AI agents for instant disaster detection, resource dispatching, bilingual public alerts, and offline-first citizen emergency reporting.
          </p>

          {/* Action CTA Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onOpenAuth}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-sm rounded-2xl shadow-xl shadow-red-950/50 flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95"
            >
              <Users className="w-5 h-5" />
              <span>Request Emergency Aid & Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onExploreMap}
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-bold text-sm rounded-2xl flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-md"
            >
              <MapPin className="w-5 h-5 text-blue-400" />
              <span>Explore GIS Disaster Map</span>
            </button>
          </div>

          {/* Telemetry live status bar */}
          <div className="pt-8 flex items-center justify-center gap-6 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              USGS Live Earthquakes Connected
            </span>
            <span className="hidden sm:flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              Open-Meteo Weather Feed Active
            </span>
            <span className="flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-amber-400" />
              PWA IndexedDB Offline Sync Enabled
            </span>
          </div>

        </div>
      </section>

      {/* SECTION 2: CORE CONCEPT — THE 4 COOPERATIVE AGENTS (Bento Grid dark layout with high contrast cards) */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full bg-slate-900/50 border-y border-slate-800/80 rounded-3xl my-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-display">
            Autonomous 4-Agent Cooperation Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            Each specialized agent processes disaster inputs and hands structured JSON payloads to the next in real time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Agent 1 */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-red-900/40 relative group hover:border-red-600 transition-all shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-red-950 border border-red-700 flex items-center justify-center text-red-400 mb-4 group-hover:scale-110 transition-transform">
              <Radio className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
              Agent 1
            </span>
            <h3 className="text-lg font-bold text-white mt-2">Detection Agent</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Classifies disaster type (earthquake, flood, fire, cyclone) & severity level from live USGS or Open-Meteo feeds.
            </p>
          </div>

          {/* Agent 2 */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-emerald-900/40 relative group hover:border-emerald-600 transition-all shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-700 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
              Agent 2
            </span>
            <h3 className="text-lg font-bold text-white mt-2">Resource Agent</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Matches event severity to available shelters, medical centers, and NDRF rescue teams from live inventory.
            </p>
          </div>

          {/* Agent 3 */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-amber-900/40 relative group hover:border-amber-600 transition-all shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-amber-950 border border-amber-700 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
              Agent 3
            </span>
            <h3 className="text-lg font-bold text-white mt-2">Communication Agent</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Generates color-coded emergency alerts in English & Tamil with actionable safety steps.
            </p>
          </div>

          {/* Agent 4 */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-cyan-900/40 relative group hover:border-cyan-600 transition-all shadow-lg">
            <div className="w-12 h-12 rounded-xl bg-cyan-950 border border-cyan-700 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
              Agent 4
            </span>
            <h3 className="text-lg font-bold text-white mt-2">Citizen Report Agent</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Extracts locations & distress needs from citizen chat messages or 1-tap emergency buttons.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3: LIVE TELEMETRY & MAP PREVIEW (Warm slate section with distinct layout) */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950 text-blue-400 text-xs font-semibold border border-blue-800">
            <MapPin className="w-3.5 h-3.5" /> Real-Time Telemetry & Rain Radar
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-white font-display leading-tight">
            Integrated GIS Maps, Weather Radar, and USGS Feeds
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            View live seismic data directly from USGS API, real-time rainfall forecasts from Open-Meteo, and live precipitation radar overlays from RainViewer on Leaflet satellite maps.
          </p>

          <ul className="space-y-3 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              🔴 Red Pins: Critical USGS Seismic Events & High Severity Fires/Floods
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              🟡 Amber Pins: Active Citizen Distress Reports
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              🟢 Green Pins: Available Relief Shelters & Triage Hospitals
            </li>
          </ul>

          <button
            onClick={onExploreMap}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
          >
            <span>Launch Live GIS Interactive Map</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Map Mock Graphic */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
          <div className="flex justify-between items-center pb-4 border-b border-slate-800 text-xs">
            <span className="text-slate-300 font-bold flex items-center gap-2">
              <Radio className="w-4 h-4 text-red-500 animate-pulse" /> GIS Telemetry View
            </span>
            <span className="text-slate-400 font-mono">OpenStreetMap + Esri Satellite</span>
          </div>

          <div className="my-6 h-64 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-center relative overflow-hidden">
            {/* Simulated Radar Circles */}
            <div className="absolute w-48 h-48 rounded-full border border-red-500/30 animate-ping"></div>
            <div className="absolute w-32 h-32 rounded-full border border-amber-500/40"></div>
            
            <div className="relative z-10 text-center space-y-2">
              <ShieldAlert className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-xs font-bold text-white">Live RainViewer Radar & USGS Layers Active</p>
              <p className="text-[10px] text-slate-400">Click below to open interactive full-screen map</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: OFFLINE PWA CAPABILITY (Clean high contrast highlight) */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/80 border border-slate-800 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800">
              <Wifi className="w-3.5 h-3.5" /> PWA + IndexedDB Zero-Connection Engine
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-white font-display">
              Works Even When Cell Towers Fail Fully Offline
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Citizen reports are instantly saved to browser IndexedDB and exact GPS coordinates are captured at the moment network drops. Flushes automatically when connection returns.
            </p>
          </div>

          <button
            onClick={onOpenAuth}
            className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-2xl shadow-xl shrink-0 transition-transform hover:scale-105"
          >
            Launch Offline Citizen Emergency Mode
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 text-center text-xs text-slate-400 border-t border-slate-800/80">
        <p>Disaster Response Hub — Powered by Multi-Agent AI (Gemini + Groq Fallback Engine)</p>
      </footer>
    </div>
  );
};
