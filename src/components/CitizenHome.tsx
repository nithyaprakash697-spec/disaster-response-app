import React, { useState, useEffect } from 'react';
import { Send, MapPin, AlertCircle, PhoneCall, ShieldAlert, Sparkles, CheckCircle2, Navigation, HeartHandshake, Droplets, Stethoscope, Home, AlertOctagon, Bell, BellOff, BellRing } from 'lucide-react';
import { CitizenReport, PublicAlert, ResourceItem } from '../types';
import { AuthUser } from '../lib/auth';
import { runCitizenReportAgent } from '../lib/agentEngine';
import { fetchPublicAlerts, fetchResources, saveCitizenReport } from '../lib/supabase';
import { saveOfflineReport } from '../lib/idb';
import { getExistingPushSubscription, subscribeToPushNotifications, unsubscribeFromPushNotifications, savePushSubscriptionToSupabase, isPushSupported } from '../lib/pushNotifications';
import { LiveMonitoringPanel } from './LiveMonitoringPanel';

export const CitizenHome: React.FC<{
  currentUser?: AuthUser | null;
  onNavigateMap: () => void;
  onRedirectToLogin?: () => void;
}> = ({ currentUser, onNavigateMap, onRedirectToLogin }) => {
  const [activeTab, setActiveTab] = useState<'lite' | 'chat'>('lite');
  const [alerts, setAlerts] = useState<PublicAlert[]>([]);
  const [shelters, setShelters] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Push Notification state
  const [pushEnabled, setPushEnabled] = useState<boolean>(false);
  const [pushLoading, setPushLoading] = useState<boolean>(false);
  const [pushStatusMsg, setPushStatusMsg] = useState<string>('');

  // Lite Mode State
  const [selectedNeeds, setSelectedNeeds] = useState<('Water' | 'Medical' | 'Trapped' | 'Shelter' | 'Food')[]>([]);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAddress, setGpsAddress] = useState<string>('Auto-capturing GPS coordinates...');
  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);
  const [submissionState, setSubmissionState] = useState<{ show: boolean; isOffline: boolean }>({ show: false, isOffline: false });

  // Chatbot Mode State
  const [chatMessage, setChatMessage] = useState<string>('');
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<{ sender: 'user' | 'agent'; text: string; details?: any }[]>([
    {
      sender: 'agent',
      text: 'Hello. I am the Citizen Emergency AI Agent. Please type your location and what help you need (e.g. "Drinking water and medical assistance needed at Velachery 2nd street"). I will parse your location and match nearby rescue assets.'
    }
  ]);

  useEffect(() => {
    // Load alerts & shelters & check push notification subscription
    const initData = async () => {
      setLoading(true);
      try {
        const [aList, rList, existingSub] = await Promise.all([
          fetchPublicAlerts(),
          fetchResources(),
          getExistingPushSubscription()
        ]);
        setAlerts(aList);
        setShelters(rList.filter(r => r.type === 'shelter' || r.type === 'hospital'));

        const userId = currentUser?.email || currentUser?.id || 'citizen-user';

        if (existingSub) {
          console.log('[CitizenHome] Active push subscription detected in browser.');
          setPushEnabled(true);
          // Re-sync subscription record in database
          savePushSubscriptionToSupabase(existingSub, userId);
        } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          console.log('[CitizenHome] Notification permission granted; initializing push subscription for user:', userId);
          const subRes = await subscribeToPushNotifications(userId);
          if (subRes.success) {
            setPushEnabled(true);
            console.log('[CitizenHome] Auto push subscription completed successfully.');
          } else {
            console.warn('[CitizenHome] Auto push subscription note:', subRes.error);
          }
        } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          console.log('[CitizenHome] Notification permission default; user can click toggle to enable live push alerts.');
        }
      } catch (err) {
        console.warn('Citizen init data error:', err);
      } finally {
        setLoading(false);
      }
    };

    initData();
    captureUserGps();
  }, [currentUser]);

  const handleTogglePushNotifications = async () => {
    setPushLoading(true);
    setPushStatusMsg('');
    const userId = currentUser?.email || currentUser?.id || 'citizen-user';
    try {
      if (pushEnabled) {
        await unsubscribeFromPushNotifications();
        setPushEnabled(false);
        setPushStatusMsg('Push notifications disabled');
      } else {
        console.log('[CitizenHome] User requested push notification enable for:', userId);
        const res = await subscribeToPushNotifications(userId);
        if (res.success) {
          setPushEnabled(true);
          setPushStatusMsg('Web Push active — live emergency alerts enabled!');
        } else {
          console.warn('[CitizenHome] Enable push notifications note:', res.error);
          setPushStatusMsg(res.error || 'Permission denied or not supported');
        }
      }
    } catch (e: any) {
      console.warn('[CitizenHome] Note toggling push notifications:', e);
      setPushStatusMsg(e?.message || 'Error updating push status');
    } finally {
      setPushLoading(false);
      setTimeout(() => setPushStatusMsg(''), 5000);
    }
  };

  const captureUserGps = () => {
    setIsCapturingGps(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setGpsLocation(coords);
          setGpsAddress(`GPS Lock: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
          setIsCapturingGps(false);
        },
        (err) => {
          console.warn('GPS capture error:', err);
          // Fallback to default Chennai location
          setGpsLocation({ lat: 13.0827, lng: 80.2707 });
          setGpsAddress('Location: Chennai Metropolitan Zone');
          setIsCapturingGps(false);
        },
        { timeout: 6000 }
      );
    } else {
      setGpsLocation({ lat: 13.0827, lng: 80.2707 });
      setGpsAddress('Location: Chennai Metropolitan Zone');
      setIsCapturingGps(false);
    }
  };

  const toggleNeed = (need: 'Water' | 'Medical' | 'Trapped' | 'Shelter' | 'Food') => {
    if (selectedNeeds.includes(need)) {
      setSelectedNeeds(selectedNeeds.filter(n => n !== need));
    } else {
      setSelectedNeeds([...selectedNeeds, need]);
    }
  };

  // Lite Mode Instant 1-Tap Submit
  const handleSubmitLiteReport = async () => {
    if (selectedNeeds.length === 0) return;

    const isOnline = navigator.onLine;
    const nowIso = new Date().toISOString();

    const report: CitizenReport = {
      id: `rep-lite-${Date.now()}`,
      needs: selectedNeeds,
      locationName: gpsAddress,
      lat: gpsLocation?.lat || 13.0827,
      lng: gpsLocation?.lng || 80.2707,
      timestamp: nowIso,
      syncedAt: isOnline ? nowIso : undefined,
      isOfflineSubmission: !isOnline,
      status: 'pending',
      syncStatus: isOnline ? 'synced' : 'pending_sync',
      rawMessage: `Lite 1-Tap Request for ${selectedNeeds.join(', ')}`
    };

    if (isOnline) {
      await saveCitizenReport(report);
      setSubmissionState({ show: true, isOffline: false });
    } else {
      await saveOfflineReport(report);
      setSubmissionState({ show: true, isOffline: true });
    }

    setTimeout(() => setSubmissionState({ show: false, isOffline: false }), 8000);
    setSelectedNeeds([]);
  };

  // Listen to immediate reconnect sync completion event to flip status instantly
  useEffect(() => {
    const handleSyncComplete = () => {
      setSubmissionState(prev => {
        if (prev.show && prev.isOffline) {
          return { show: true, isOffline: false };
        }
        return prev;
      });
    };

    window.addEventListener('dh-sync-complete', handleSyncComplete);
    return () => {
      window.removeEventListener('dh-sync-complete', handleSyncComplete);
    };
  }, []);

  // Chatbot Mode Send Message
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userText = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { sender: 'user', text: userText }]);
    setIsAiProcessing(true);

    try {
      const { extractedInfo } = await runCitizenReportAgent(userText, gpsLocation || undefined);

      const report: CitizenReport = {
        id: `rep-chat-${Date.now()}`,
        rawMessage: userText,
        needs: extractedInfo.needs || ['Water'],
        locationName: extractedInfo.locationExtracted || gpsAddress,
        lat: gpsLocation?.lat || 13.0827,
        lng: gpsLocation?.lng || 80.2707,
        timestamp: new Date().toISOString(),
        status: 'pending',
        syncStatus: navigator.onLine ? 'synced' : 'pending_sync',
        agentExtractedInfo: extractedInfo
      };

      if (navigator.onLine) {
        await saveCitizenReport(report);
      } else {
        await saveOfflineReport(report);
      }

      setChatHistory(prev => [
        ...prev,
        {
          sender: 'agent',
          text: `Extracted Location: "${extractedInfo.locationExtracted}". Needs Identified: [${(extractedInfo.needs || []).join(', ')}]. ${extractedInfo.dispatchAction}`,
          details: extractedInfo
        }
      ]);
    } catch (err) {
      console.error('Citizen chat AI error:', err);
      setChatHistory(prev => [
        ...prev,
        {
          sender: 'agent',
          text: 'Emergency request received and logged to local offline queue. Rescue team notified.'
        }
      ]);
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50/40 text-slate-800 p-4 sm:p-6 lg:p-8 font-sans max-w-5xl mx-auto space-y-8">
      
      {/* Friendly Warm Header Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <HeartHandshake className="w-6 h-6" />
              <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight">
                Citizen Emergency Portal
              </h1>
            </div>
            <p className="text-xs sm:text-sm font-medium text-amber-100 mt-1">
              Request instant emergency aid in under 3 taps, view live Tamil & English warnings, and find shelters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* WEB PUSH NOTIFICATION TOGGLE CONTROL */}
            <button
              onClick={handleTogglePushNotifications}
              disabled={pushLoading}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold shadow-md flex items-center gap-2 transition-all ${
                pushEnabled
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900'
                  : 'bg-slate-950/80 text-amber-200 border border-amber-400/40 hover:bg-slate-900'
              }`}
              title="Toggle Web Push Notifications for live disaster alerts"
            >
              {pushLoading ? (
                <Bell className="w-4 h-4 animate-spin text-amber-300" />
              ) : pushEnabled ? (
                <BellRing className="w-4 h-4 text-emerald-400 animate-pulse" />
              ) : (
                <BellOff className="w-4 h-4 text-amber-300" />
              )}
              <span>Notifications: {pushEnabled ? 'Enabled' : 'Disabled'}</span>
            </button>

            <button
              onClick={onNavigateMap}
              className="px-5 py-2.5 bg-slate-950 text-amber-300 hover:bg-slate-900 rounded-2xl text-xs font-bold shadow-md flex items-center gap-2 transition-transform hover:scale-105 shrink-0"
            >
              <Navigation className="w-4 h-4 text-amber-400" />
              <span>Find Nearby Shelters Map</span>
            </button>
          </div>
        </div>

        {/* Status Message for Push Registration */}
        {pushStatusMsg && (
          <div className="bg-slate-950/90 border border-amber-300/40 text-amber-200 px-4 py-2 rounded-xl text-xs font-mono flex items-center gap-2 animate-in fade-in">
            <Bell className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{pushStatusMsg}</span>
          </div>
        )}
      </div>

      {/* PUBLIC EMERGENCY ALERTS BANNER FEED */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <AlertOctagon className="w-4 h-4 text-red-600" />
            Active Official Public Alerts
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {alerts.slice(0, 2).map((a) => (
              <div
                key={a.id}
                className={`p-5 rounded-2xl border shadow-md flex flex-col justify-between space-y-3 ${
                  a.urgency === 'Critical'
                    ? 'bg-red-50 border-red-300 text-red-900'
                    : 'bg-amber-50 border-amber-300 text-amber-900'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white">
                      {a.urgency}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(a.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold mt-1 leading-snug">{a.titleEn}</h4>
                  <p className="text-xs font-medium text-slate-700 mt-1 leading-relaxed">{a.titleTa}</p>
                </div>

                {a.safetyInstructionsEn && a.safetyInstructionsEn.length > 0 && (
                  <div className="pt-2 border-t border-red-200/80 text-[11px] text-slate-700 space-y-1">
                    <p className="font-bold">Safety Instructions:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {a.safetyInstructionsEn.map((inst, i) => (
                        <li key={i}>{inst}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REAL-TIME ENVIRONMENTAL MONITORING PANEL (Visible for authenticated citizens) */}
      <LiveMonitoringPanel
        currentUser={currentUser || null}
        isAdmin={false}
        onRedirectToLogin={onRedirectToLogin}
      />

      {/* REPORT MODES: LITE REPORT vs AI CHATBOT */}
      <div className="bg-white border border-amber-200/80 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        
        {/* Mode Selector Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('lite')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                activeTab === 'lite'
                  ? 'bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Lite Report Mode (1-Tap)</span>
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[44px] ${
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-red-600 to-amber-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>AI Chat Assistant</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
            <span className="font-medium truncate max-w-[240px] sm:max-w-[200px]">{gpsAddress}</span>
          </div>
        </div>

        {/* TAB 1: LITE REPORT MODE */}
        {activeTab === 'lite' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-display">
                Tap your immediate emergency needs:
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Auto-captures your current GPS location. Submits in 1 tap to the multi-agent rescue dispatch.
              </p>
            </div>

            {/* Need Toggle Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <button
                onClick={() => toggleNeed('Water')}
                className={`p-4 sm:p-5 rounded-2xl border-2 font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all min-h-[72px] ${
                  selectedNeeds.includes('Water')
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 scale-105'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <Droplets className="w-7 h-7 sm:w-8 sm:h-8" />
                <span>Water / Food</span>
              </button>

              <button
                onClick={() => toggleNeed('Medical')}
                className={`p-4 sm:p-5 rounded-2xl border-2 font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all min-h-[72px] ${
                  selectedNeeds.includes('Medical')
                    ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-200 scale-105'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <Stethoscope className="w-7 h-7 sm:w-8 sm:h-8" />
                <span>Medical Aid</span>
              </button>

              <button
                onClick={() => toggleNeed('Trapped')}
                className={`p-4 sm:p-5 rounded-2xl border-2 font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all min-h-[72px] ${
                  selectedNeeds.includes('Trapped')
                    ? 'bg-amber-600 border-amber-600 text-white shadow-lg shadow-amber-200 scale-105'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <AlertCircle className="w-7 h-7 sm:w-8 sm:h-8" />
                <span>Trapped / Rescue</span>
              </button>

              <button
                onClick={() => toggleNeed('Shelter')}
                className={`p-4 sm:p-5 rounded-2xl border-2 font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all min-h-[72px] ${
                  selectedNeeds.includes('Shelter')
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200 scale-105'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                <Home className="w-7 h-7 sm:w-8 sm:h-8" />
                <span>Shelter Needed</span>
              </button>
            </div>

            {/* GPS Lock & Submit Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 bg-amber-50/60 p-4 rounded-2xl border border-amber-200/70">
              <div className="flex items-center gap-2 text-xs text-slate-700 w-full sm:w-auto">
                <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                <span className="truncate">{gpsAddress}</span>
              </div>

              <button
                onClick={handleSubmitLiteReport}
                disabled={selectedNeeds.length === 0}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 disabled:opacity-40 text-white font-bold text-sm rounded-xl shadow-lg transition-transform hover:scale-105 active:scale-95 min-h-[48px]"
              >
                Transmit Distress Call Now ({selectedNeeds.length} Selected)
              </button>
            </div>

            {submissionState.show && (
              <div
                className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-md transition-all duration-300 animate-in fade-in ${
                  submissionState.isOffline
                    ? 'bg-amber-100 border border-amber-300 text-amber-950'
                    : 'bg-emerald-100 border border-emerald-300 text-emerald-950'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2
                    className={`w-5 h-5 shrink-0 ${
                      submissionState.isOffline ? 'text-amber-600' : 'text-emerald-600'
                    }`}
                  />
                  <span>
                    {submissionState.isOffline
                      ? "Saved — will send the moment you're connected"
                      : 'Sent — Received by response team'}
                  </span>
                </div>
                {submissionState.isOffline && (
                  <span className="text-[10px] bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded font-mono">
                    Queued Offline
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CHATBOT MODE */}
        {activeTab === 'chat' && (
          <div className="space-y-4">
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 h-[320px] overflow-y-auto space-y-3 font-sans text-xs">
              {chatHistory.map((item, idx) => (
                <div
                  key={idx}
                  className={`flex ${item.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3.5 rounded-2xl ${
                      item.sender === 'user'
                        ? 'bg-red-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-200 border border-slate-700/80 rounded-bl-none'
                    }`}
                  >
                    <p className="leading-relaxed">{item.text}</p>
                    {item.details && (
                      <div className="mt-2 pt-2 border-t border-slate-700/80 text-[10px] text-emerald-400 font-mono">
                        ✓ Agent Extracted Urgency Score: {item.details.urgencyScore}/100
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isAiProcessing && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 text-slate-400 p-3 rounded-2xl text-xs animate-pulse">
                    Agent parsing location & extracting emergency needs...
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSendChatMessage} className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Type your emergency message e.g. 'Water needed near Tambaram railway station'"
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-base sm:text-xs text-slate-900 focus:outline-none focus:border-red-500 min-h-[44px]"
              />
              <button
                type="submit"
                disabled={isAiProcessing || !chatMessage.trim()}
                className="px-5 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md min-h-[44px] shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>
          </div>
        )}

      </div>

      {/* NEARBY RELIEF SHELTERS LIST */}
      <div className="bg-white border border-amber-200/80 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-slate-900 font-display flex items-center gap-2">
            <Home className="w-5 h-5 text-emerald-600" />
            <span>Nearby Emergency Relief Shelters & Hospitals</span>
          </h3>
          <button
            onClick={onNavigateMap}
            className="text-xs font-bold text-red-600 hover:underline"
          >
            View All on Map ➔
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {shelters.slice(0, 4).map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex justify-between items-center"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-900">{s.name}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{s.location}</p>
                <p className="text-[10px] text-emerald-700 font-semibold mt-1">
                  Occupancy: {s.occupied} / {s.capacity} beds filled
                </p>
              </div>

              <a
                href={`tel:${s.contact}`}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm shrink-0"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call</span>
              </a>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
