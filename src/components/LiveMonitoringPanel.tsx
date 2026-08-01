import React, { useState, useEffect, useRef } from 'react';
import { Wind, Waves, Droplets, Flame, Info, RefreshCw, Sliders, ShieldAlert, CheckCircle2, AlertTriangle, AlertCircle, Clock, Lock, TrendingUp, TrendingDown, Minus, Sparkles, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { EnvironmentalTelemetry, EnvironmentalThresholds, DEFAULT_THRESHOLDS, fetchEnvironmentalTelemetry, checkAndTriggerAgentPipelineOnWarning } from '../lib/environmentalMonitoring';
import { AuthUser } from '../lib/auth';

interface LiveMonitoringPanelProps {
  currentUser: AuthUser | null;
  isAdmin?: boolean;
  onRedirectToLogin?: () => void;
}

/**
 * Safe number formatting helper
 */
const fmtNum = (val: any, decimals = 1): string => {
  const num = typeof val === 'number' && !isNaN(val) ? val : 0;
  return num.toFixed(decimals);
};

/**
 * Animated Number Counter for smooth transitions when new telemetry values refresh
 */
const AnimatedNumber: React.FC<{ value: number; decimals?: number; suffix?: string }> = ({ value, decimals = 1, suffix = '' }) => {
  const safeVal = typeof value === 'number' && !isNaN(value) ? value : 0;
  const [displayValue, setDisplayValue] = useState(safeVal);
  const prevValueRef = useRef(safeVal);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startVal = prevValueRef.current;
    const endVal = safeVal;
    const duration = 600; // ms

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = startVal + (endVal - startVal) * progress;
      setDisplayValue(current);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        prevValueRef.current = safeVal;
      }
    };

    const handle = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(handle);
  }, [safeVal]);

  return <span>{fmtNum(displayValue, decimals)}{suffix}</span>;
};

/**
 * Recharts Mini Sparkline Trend Chart Component
 */
const SparklineTrend: React.FC<{
  points: { time: string; value: number }[];
  color: string;
}> = ({ points, color }) => {
  if (!points || points.length === 0) return null;
  const peakVal = Math.max(...points.map(p => p.value));

  return (
    <div className="h-12 w-full mt-2 pt-1 border-t border-slate-800/80">
      <div className="text-[9px] font-mono text-slate-400 mb-0.5 flex items-center justify-between">
        <span className="flex items-center gap-1"><Activity className="w-2.5 h-2.5 text-amber-400" /> 24h Trend</span>
        <span>Peak: {peakVal}</span>
      </div>
      <ResponsiveContainer width="100%" height={28}>
        <AreaChart data={points} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="time" hide />
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Tooltip
            contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '8px', fontSize: '10px', color: '#f8fafc', padding: '4px 8px' }}
            itemStyle={{ color: '#f59e0b' }}
            formatter={(val: any) => [`${val}`, 'Forecast']}
            labelFormatter={(label: any) => `Time: ${label}`}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fillOpacity={1} fill={`url(#sparkGrad-${color.replace('#', '')})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const LiveMonitoringPanel: React.FC<LiveMonitoringPanelProps> = ({ currentUser, isAdmin = false, onRedirectToLogin }) => {
  const [telemetry, setTelemetry] = useState<EnvironmentalTelemetry | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [lastUpdatedTime, setLastUpdatedTime] = useState<Date | null>(null);
  const [minutesAgo, setMinutesAgo] = useState<number>(0);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [showAdminThresholds, setShowAdminThresholds] = useState<boolean>(false);
  const [triggerNotice, setTriggerNotice] = useState<string | null>(null);

  // Admin Custom Thresholds state
  const [thresholds, setThresholds] = useState<EnvironmentalThresholds>(DEFAULT_THRESHOLDS);

  // Auto-refresh polling mechanism (10 minutes = 600,000 ms)
  const POLL_INTERVAL_MS = 10 * 60 * 1000;

  const loadTelemetryData = async (activeThresholds: EnvironmentalThresholds = thresholds, isSilentRefresh: boolean = false) => {
    // ACCESS CONTROL: Enforce valid logged-in user check
    if (!currentUser) {
      setErrorMsg('Access Restricted: Please sign in to view real-time telemetry.');
      if (onRedirectToLogin) onRedirectToLogin();
      return;
    }

    if (telemetry || isSilentRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMsg(null);

    const res = await fetchEnvironmentalTelemetry(13.0827, 80.2707, activeThresholds);
    if (!res.success || !res.data) {
      setErrorMsg(res.error || 'Failed to connect to environmental monitoring sensors.');
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    setTelemetry(res.data);
    const now = new Date();
    setLastRefreshed(now.toLocaleTimeString());
    setLastUpdatedTime(now);
    setMinutesAgo(0);
    setLoading(false);
    setIsRefreshing(false);

    // AUTO AGENT TRIGGER: Automatically feed data into Detection Agent if Warning status crossed
    checkAndTriggerAgentPipelineOnWarning(res.data).then(triggerRes => {
      if (triggerRes.triggered) {
        setTriggerNotice(`🚨 Threshold Warning Detected! Automated Agent Pipeline launched for ${triggerRes.disasterType?.toUpperCase() || 'Disaster Event'}.`);
        setTimeout(() => setTriggerNotice(null), 10000);
      }
    });
  };

  useEffect(() => {
    loadTelemetryData();

    // Set up 10-minute consistent auto-refresh polling mechanism
    const timer = setInterval(() => {
      loadTelemetryData(thresholds, true);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [currentUser]);

  // Relative timestamp ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      if (lastUpdatedTime) {
        const mins = Math.floor((Date.now() - lastUpdatedTime.getTime()) / 60000);
        setMinutesAgo(mins);
      }
    }, 20000);
    return () => clearInterval(ticker);
  }, [lastUpdatedTime]);

  const handleUpdateThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    loadTelemetryData(thresholds);
    setShowAdminThresholds(false);
  };

  // If user is logged out, block view completely
  if (!currentUser) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center space-y-4 max-w-xl mx-auto my-8">
        <Lock className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
        <h3 className="text-lg font-bold text-white font-display">Authentication Required</h3>
        <p className="text-xs text-slate-400">
          The Real-Time Environmental Risk Monitoring System is protected and accessible only to verified citizens and response authorities.
        </p>
        <button
          onClick={onRedirectToLogin}
          className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-2xl shadow-lg transition-transform hover:scale-105"
        >
          Sign In to Access Telemetry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/95 border border-slate-800/90 rounded-3xl p-6 shadow-2xl space-y-6 text-slate-100 font-sans">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white font-display tracking-tight">
                Real-Time Environmental Risk Monitoring
              </h2>
              
              {/* HONESTY LABEL TOOLTIP */}
              <div className="relative inline-block">
                <button
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onClick={() => setShowTooltip(!showTooltip)}
                  className="text-slate-400 hover:text-amber-300 transition-colors p-1"
                  title="Honesty Info"
                >
                  <Info className="w-4 h-4" />
                </button>
                {showTooltip && (
                  <div className="absolute z-30 left-0 sm:left-auto sm:right-0 mt-2 w-72 p-3 bg-slate-950 border border-slate-700 rounded-2xl text-[11px] text-slate-300 shadow-2xl backdrop-blur-md animate-in fade-in">
                    <p className="font-semibold text-amber-300 mb-1 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> Sensor Telemetry Note
                    </p>
                    Status is based on real-time environmental data and threshold rules, not long-range forecasting models.
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
              <span>Open-Meteo & NASA FIRMS Telemetry Engine</span>
              {lastRefreshed && (
                <span className="text-[10px] font-mono bg-slate-800 px-2.5 py-0.5 rounded-full text-slate-300 flex items-center gap-1.5 border border-slate-700">
                  <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>
                    Last updated: {minutesAgo === 0 ? 'Just now' : `${minutesAgo}m ago`} ({lastRefreshed})
                  </span>
                  {isRefreshing && (
                    <span className="flex items-center gap-1 text-amber-400 font-sans ml-1">
                      <RefreshCw className="w-2.5 h-2.5 animate-spin shrink-0" />
                      <span className="text-[9px]">Updating...</span>
                    </span>
                  )}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <button
              onClick={() => setShowAdminThresholds(!showAdminThresholds)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Sliders className="w-4 h-4" />
              <span>{showAdminThresholds ? 'Hide Thresholds' : 'Configure Thresholds'}</span>
            </button>
          )}

          <button
            onClick={() => loadTelemetryData(thresholds, true)}
            disabled={isRefreshing || loading}
            className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || isRefreshing) ? 'animate-spin' : ''}`} />
            <span>{(loading || isRefreshing) ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* AUTOMATED AGENT PIPELINE TRIGGER NOTICE */}
      {triggerNotice && (
        <div className="bg-red-950/80 border border-red-500 text-red-100 p-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-slide-down shadow-xl">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 animate-bounce" />
          <span>{triggerNotice}</span>
        </div>
      )}

      {/* ADMIN THRESHOLD CONFIGURATION PANEL (Admin Only) */}
      {isAdmin && showAdminThresholds && (
        <form onSubmit={handleUpdateThresholds} className="bg-slate-950 border border-amber-500/30 p-5 rounded-2xl space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-amber-400 font-display flex items-center gap-1.5">
              <Sliders className="w-4 h-4" /> Admin Alert Threshold Customization
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Updates active risk calculation model</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Wind Speed Warning (km/h)</label>
              <input
                type="number"
                value={thresholds.windSpeedWarningKmH}
                onChange={e => setThresholds({ ...thresholds, windSpeedWarningKmH: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-xs text-white font-mono min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Wave Height Warning (m)</label>
              <input
                type="number"
                step="0.1"
                value={thresholds.waveHeightWarningM}
                onChange={e => setThresholds({ ...thresholds, waveHeightWarningM: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-xs text-white font-mono min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">River Discharge Warning (m³/s)</label>
              <input
                type="number"
                value={thresholds.dischargeWarningM3s}
                onChange={e => setThresholds({ ...thresholds, dischargeWarningM3s: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-xs text-white font-mono min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Fire Hotspots Warning Count</label>
              <input
                type="number"
                value={thresholds.fireHotspotsWarningCount}
                onChange={e => setThresholds({ ...thresholds, fireHotspotsWarningCount: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-base sm:text-xs text-white font-mono min-h-[44px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setThresholds(DEFAULT_THRESHOLDS)}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-xl hover:bg-slate-700"
            >
              Reset Defaults
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl hover:bg-amber-400"
            >
              Apply Threshold Rules
            </button>
          </div>
        </form>
      )}

      {/* ERROR STATE */}
      {errorMsg && (
        <div className="p-4 bg-red-950/60 border border-red-800 text-red-200 rounded-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* SHORT-TERM FORECAST HONESTY BANNER & PREDICTED WARNINGS */}
      {telemetry && (
        <div className="bg-slate-950/80 border border-slate-800/90 p-3 sm:p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-slate-200">
                Short-term Meteorological Forecast (24-48 hours)
              </p>
              <p className="text-[11px] text-slate-400">
                Short-term forecast based on live meteorological data (24-48 hours) — not long-range disaster prediction.
              </p>
            </div>
          </div>

          {telemetry.predictedWarnings && telemetry.predictedWarnings.length > 0 ? (
            <div className="bg-amber-950/90 border border-amber-500/60 text-amber-200 px-3.5 py-1.5 rounded-xl font-mono text-[11px] flex items-center gap-2 shrink-0 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                🚨 {telemetry.predictedWarnings.length} Predicted Risk(s): {telemetry.predictedWarnings[0].type.toUpperCase()} worsens in ~{telemetry.predictedWarnings[0].hoursAhead}h
              </span>
            </div>
          ) : (
            <div className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-3 py-1 rounded-xl flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>24h Forecast Stable</span>
            </div>
          )}
        </div>
      )}

      {/* 4 STATUS CARDS GRID */}
      {telemetry && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* CARD 1: WEATHER STATUS */}
          <StatusCard
            title="Weather Status"
            icon={<Wind className="w-6 h-6 animate-wind-drift" />}
            status={telemetry.weather.status}
            statusLabel={telemetry.weather.status}
            mainValue={<AnimatedNumber value={telemetry.weather.windSpeedKmH} suffix=" km/h" />}
            mainValueLabel="Wind Velocity"
            trendDirection={telemetry.weather.forecast.trendDirection}
            forecastSummary={telemetry.weather.forecast.summary}
            forecastPoints={telemetry.weather.forecast.points}
            sparkColor="#38bdf8"
            subDetails={[
              `Rain: ${fmtNum(telemetry.weather.rainRateMmH, 1)} mm/h`,
              `Temp: ${fmtNum(telemetry.weather.tempC, 1)}°C`,
              `Cond: ${telemetry.weather.condition || 'Clear'}`
            ]}
          />

          {/* CARD 2: WAVE HEIGHT STATUS */}
          <StatusCard
            title="Wave Height Status"
            icon={<Waves className="w-6 h-6 animate-wave-sway" />}
            status={telemetry.waveHeight.status}
            statusLabel={telemetry.waveHeight.status}
            mainValue={<AnimatedNumber value={telemetry.waveHeight.heightM} decimals={2} suffix=" m" />}
            mainValueLabel="Ocean Wave Height"
            trendDirection={telemetry.waveHeight.forecast.trendDirection}
            forecastSummary={telemetry.waveHeight.forecast.summary}
            forecastPoints={telemetry.waveHeight.forecast.points}
            sparkColor="#818cf8"
            subDetails={[
              `Swell: ${fmtNum(telemetry.waveHeight.swellM, 1)} m`,
              `Period: ${fmtNum(telemetry.waveHeight.periodSec, 1)} s`,
              `Zone: Coromandel Belt`
            ]}
          />

          {/* CARD 3: FLOOD RISK STATUS */}
          <StatusCard
            title="Flood Risk Status"
            icon={<Droplets className="w-6 h-6 animate-water-rise" />}
            status={telemetry.floodRisk.status}
            statusLabel={telemetry.floodRisk.status}
            mainValue={<AnimatedNumber value={telemetry.floodRisk.riverDischargeM3s} decimals={1} suffix=" m³/s" />}
            mainValueLabel="River Discharge"
            trendDirection={telemetry.floodRisk.forecast.trendDirection}
            forecastSummary={telemetry.floodRisk.forecast.summary}
            forecastPoints={telemetry.floodRisk.forecast.points}
            sparkColor="#34d399"
            subDetails={[
              `Rain Intensity: ${fmtNum(telemetry.floodRisk.rainfallMmH, 1)} mm/h`,
              `Discharge Trend: ${telemetry.floodRisk.trend}`,
              `Basin: Adyar/Palar River`
            ]}
          />

          {/* CARD 4: FIRE RISK STATUS */}
          <StatusCard
            title="Fire Risk Status"
            icon={
              <Flame
                className={`w-6 h-6 ${
                  telemetry.fireRisk.status !== 'Normal' ? 'animate-flame-flicker text-amber-400' : ''
                }`}
              />
            }
            status={telemetry.fireRisk.status}
            statusLabel={telemetry.fireRisk.status}
            mainValue={<AnimatedNumber value={telemetry.fireRisk.hotspotCount} decimals={0} suffix=" Hotspots" />}
            mainValueLabel="NASA FIRMS Satellites"
            trendDirection={telemetry.fireRisk.forecast.trendDirection}
            forecastSummary={telemetry.fireRisk.forecast.summary}
            forecastPoints={telemetry.fireRisk.forecast.points}
            sparkColor="#f59e0b"
            subDetails={[
              `Monitored Radius: 50 km`,
              `Nearest Hotspot: ${fmtNum(telemetry.fireRisk.nearestKm, 1)} km`,
              `Sensor: VIIRS SNPP`
            ]}
          />

        </div>
      )}

    </div>
  );
};

/**
 * REUSABLE STATUS CARD COMPONENT
 * Implements smooth transitions, color coding, trend indicator, and Recharts sparkline
 */
interface StatusCardProps {
  title: string;
  icon: React.ReactNode;
  status: 'Normal' | 'Watch' | 'Warning';
  statusLabel: string;
  mainValue: React.ReactNode;
  mainValueLabel: string;
  subDetails: string[];
  trendDirection?: 'rising' | 'falling' | 'stable';
  forecastSummary?: string;
  forecastPoints?: { time: string; value: number }[];
  sparkColor?: string;
}

const StatusCard: React.FC<StatusCardProps> = ({
  title,
  icon,
  status,
  statusLabel,
  mainValue,
  mainValueLabel,
  subDetails,
  trendDirection = 'stable',
  forecastSummary,
  forecastPoints = [],
  sparkColor = '#f59e0b'
}) => {
  // Color coding & animation classes
  let containerStyle = 'border-emerald-500/60 bg-slate-900/90 text-emerald-100';
  let badgeStyle = 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300';
  let iconBg = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

  if (status === 'Warning') {
    containerStyle = 'border-red-500 bg-red-950/30 text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.25)] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]';
    badgeStyle = 'bg-red-950 border-red-500 text-red-300';
    iconBg = 'bg-red-500/20 text-red-400 border-red-500/50';
  } else if (status === 'Watch') {
    containerStyle = 'border-amber-500 bg-amber-950/30 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-[pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]';
    badgeStyle = 'bg-amber-950 border-amber-500 text-amber-300';
    iconBg = 'bg-amber-500/20 text-amber-400 border-amber-500/50';
  }

  const renderTrendIcon = () => {
    if (trendDirection === 'rising') return <TrendingUp className="w-3.5 h-3.5 text-amber-400" />;
    if (trendDirection === 'falling') return <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />;
    return <Minus className="w-3.5 h-3.5 text-slate-400" />;
  };

  return (
    <div className={`p-5 rounded-2xl border transition-all duration-500 ease-in-out flex flex-col justify-between space-y-3 ${containerStyle}`}>
      
      {/* CARD TOP HEADER */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            {title}
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono border ${badgeStyle}`}>
              {statusLabel}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
              {renderTrendIcon()}
              <span className="capitalize">{trendDirection}</span>
            </span>
          </div>
        </div>

        <div className={`p-2 rounded-xl border shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>

      {/* MAIN VALUE DISPLAY WITH ANIMATED COUNTER */}
      <div>
        <div className="text-2xl font-black font-display tracking-tight text-white">
          {mainValue}
        </div>
        <div className="text-[11px] font-medium text-slate-400 mt-0.5">
          {mainValueLabel}
        </div>
      </div>

      {/* RECHARTS SPARKLINE TREND CHART */}
      {forecastPoints.length > 0 && (
        <SparklineTrend points={forecastPoints} color={sparkColor} />
      )}

      {/* FORECAST SUMMARY NOTE */}
      {forecastSummary && (
        <div className="text-[10px] text-slate-300 bg-slate-950/60 p-2 rounded-xl border border-slate-800 font-sans leading-tight">
          <span className="text-amber-400 font-bold">24h Forecast:</span> {forecastSummary}
        </div>
      )}

      {/* RAW DATA VALUES SUB-DETAILS */}
      <div className="pt-2 border-t border-slate-800/80 space-y-1">
        {subDetails.map((detail, idx) => (
          <div key={idx} className="text-[11px] font-mono text-slate-300/90 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-slate-500 shrink-0" />
            <span>{detail}</span>
          </div>
        ))}
      </div>

    </div>
  );
};
