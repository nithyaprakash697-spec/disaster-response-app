import { createClient } from '@supabase/supabase-js';
import { CitizenReport, DisasterEvent, PublicAlert, ResourceItem } from '../types';
import { cachePublicAlerts, cacheResources, getCachedPublicAlerts, getCachedResources } from './idb';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co'
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initial Mock Seed Data for instant out-of-the-box rich view & local storage persistence
const MOCK_RESOURCES: ResourceItem[] = [
  {
    id: 'res-1',
    name: 'Chennai Central Relief Shelter #1',
    type: 'shelter',
    location: 'Egmore Stadium Complex, Chennai',
    lat: 13.0782,
    lng: 80.2612,
    capacity: 500,
    occupied: 280,
    contact: '+91 44 2819 0101',
    status: 'available',
    medicalStaff: 12,
    suppliesLevel: 'High'
  },
  {
    id: 'res-2',
    name: 'Government General Emergency Hospital',
    type: 'hospital',
    location: 'Park Town, Chennai',
    lat: 13.0815,
    lng: 80.2767,
    capacity: 250,
    occupied: 210,
    contact: '+91 44 2530 5000',
    status: 'available',
    medicalStaff: 45,
    suppliesLevel: 'Medium'
  },
  {
    id: 'res-3',
    name: 'NDRF Battalion 04 - Rescue Base Alpha',
    type: 'rescue_team',
    location: 'Arakkonam / Tambaram Sector',
    lat: 12.9229,
    lng: 80.1275,
    capacity: 80,
    occupied: 42,
    contact: '+91 44 2234 1122',
    status: 'busy',
    medicalStaff: 8,
    suppliesLevel: 'High'
  },
  {
    id: 'res-4',
    name: 'Coimbatore South Medical Center & Refuge',
    type: 'hospital',
    location: 'Ramanathapuram, Coimbatore',
    lat: 11.0018,
    lng: 76.9629,
    capacity: 180,
    occupied: 175,
    contact: '+91 422 230 0000',
    status: 'full',
    medicalStaff: 20,
    suppliesLevel: 'Low'
  },
  {
    id: 'res-5',
    name: 'Madurai Coastal Flood Shelter',
    type: 'shelter',
    location: 'Anna Nagar School, Madurai',
    lat: 9.9252,
    lng: 78.1198,
    capacity: 350,
    occupied: 120,
    contact: '+91 452 253 1111',
    status: 'available',
    medicalStaff: 6,
    suppliesLevel: 'High'
  }
];

const MOCK_ALERTS: PublicAlert[] = [
  {
    id: 'alert-1',
    eventId: 'evt-101',
    titleEn: 'EMERGENCY: Coastal Storm Surge Warning for Northern Coromandel Coast',
    titleTa: 'அவசர எச்சரிக்கை: வட கொரமண்டல கடற்கரை புயல் எச்சரிக்கை',
    messageEn: 'Severe rainfall and wind gusts up to 85 km/h expected over Chennai & Kanchipuram within 6 hours. Move away from sea walls and stay indoors.',
    messageTa: 'சென்னை மற்றும் காஞ்சிபுரம் கடலோரப் பகுதிகளில் பலத்த மழை மற்றும் 85 கி.மீ வேகத்தில் காற்று வீசக்கூடும். பாதுகாப்பான கட்டிடங்களுக்குச் செல்லவும்.',
    urgency: 'Critical',
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    location: 'Chennai & Kanchipuram Coastal Belt',
    safetyInstructionsEn: [
      'Store 3 days of potable water and essential medicines.',
      'Charge emergency power banks and radios immediately.',
      'Avoid driving through waterlogged underpasses.'
    ],
    safetyInstructionsTa: [
      '3 நாட்களுக்குத் தேவையான குடிநீர் மற்றும் மருந்துகளை சேமித்து வைக்கவும்.',
      'மின்சாரம் துண்டிக்கப்படும் முன் பவர் பேங்க்களை சார்ஜ் செய்யவும்.'
    ]
  },
  {
    id: 'alert-2',
    eventId: 'evt-102',
    titleEn: 'ADVISORY: Moderate Seismic Tremor Recorded in Bay of Bengal',
    titleTa: 'அறிவுறுத்தல்: வங்காள விரிகுடாவில் நிலநடுக்க அதிர்வு',
    messageEn: 'USGS recorded a M4.8 seismic tremor at 10km depth. No tsunami threat detected for mainland India. Authorities monitoring continuously.',
    messageTa: 'வங்காள விரிகுடாவில் 4.8 ரிக்டர் அளவில் நிலநடுக்கம் பதிவானது. சுனாமி ஆபத்து இல்லை. மக்கள் அமைதியாக இருக்க கேட்டுக்கொள்ளப்படுகிறார்கள்.',
    urgency: 'Advisory',
    timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    location: 'Bay of Bengal (120km off Chennai Coast)',
    safetyInstructionsEn: [
      'No evacuation needed.',
      'Stay tuned to official disaster management feeds.'
    ],
    safetyInstructionsTa: [
      'வெளியேறத் தேவையில்லை. அதிகாரப்பூர்வ தகவல்களைப் பின்தொடரவும்.'
    ]
  }
];

const MOCK_CITIZEN_REPORTS: CitizenReport[] = [
  {
    id: 'report-1',
    citizenName: 'Karthik Raja',
    phone: '+91 98400 12345',
    rawMessage: 'Waterlevel rising up to 3ft near Tambaram railway bridge. Elderly resident needs medical assistance and drinking water.',
    needs: ['Water', 'Medical'],
    locationName: 'Tambaram West, Chennai',
    lat: 12.9249,
    lng: 80.1000,
    timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    status: 'assigned',
    syncStatus: 'synced',
    agentExtractedInfo: {
      locationExtracted: 'Tambaram West near Railway Bridge',
      urgencyScore: 82,
      dispatchAction: 'Assigned NDRF Battalion 04 for water extraction & emergency doctor transport.'
    }
  },
  {
    id: 'report-2',
    citizenName: 'Priya Sundaram',
    phone: '+91 94440 98765',
    rawMessage: 'Tree fallen on power lines at Velachery main road. Family trapped inside vehicle.',
    needs: ['Trapped', 'Medical'],
    locationName: 'Velachery Main Road, Chennai',
    lat: 12.9750,
    lng: 80.2210,
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: 'pending',
    syncStatus: 'synced',
    agentExtractedInfo: {
      locationExtracted: 'Velachery Main Road, near junction',
      urgencyScore: 94,
      dispatchAction: 'Dispatched emergency chainsaw & rescue team from Egmore base.'
    }
  }
];

// Local state for offline / non-Supabase mode
function getLocalStore<T>(key: string, initial: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : initial;
  } catch {
    return initial;
  }
}

function setLocalStore<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to update local storage:', e);
  }
}

export async function fetchResources(): Promise<ResourceItem[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('resources').select('*');
      if (!error && data && data.length > 0) {
        await cacheResources(data);
        return data as ResourceItem[];
      }
    } catch (err) {
      console.warn('Supabase fetch resources failed, falling back:', err);
    }
  }
  // Fallback to IndexedDB cache or local store
  const cached = await getCachedResources();
  if (cached && cached.length > 0) return cached;
  const store = getLocalStore<ResourceItem[]>('dh_resources', MOCK_RESOURCES);
  await cacheResources(store);
  return store;
}

export async function fetchPublicAlerts(): Promise<PublicAlert[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('alerts').select('*').order('timestamp', { ascending: false });
      if (!error && data && data.length > 0) {
        await cachePublicAlerts(data);
        return data as PublicAlert[];
      }
    } catch (err) {
      console.warn('Supabase fetch alerts failed, falling back:', err);
    }
  }
  const cached = await getCachedPublicAlerts();
  if (cached && cached.length > 0) return cached;
  const store = getLocalStore<PublicAlert[]>('dh_alerts', MOCK_ALERTS);
  await cachePublicAlerts(store);
  return store;
}

export async function fetchCitizenReports(): Promise<CitizenReport[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('citizen_reports').select('*').order('timestamp', { ascending: false });
      if (!error && data) {
        return data as CitizenReport[];
      }
    } catch (err) {
      console.warn('Supabase fetch citizen reports failed, falling back:', err);
    }
  }
  return getLocalStore<CitizenReport[]>('dh_citizen_reports', MOCK_CITIZEN_REPORTS);
}

export async function saveCitizenReport(report: CitizenReport): Promise<CitizenReport> {
  let savedReport: CitizenReport = { ...report, syncStatus: 'synced' };
  
  if (isSupabaseConfigured && navigator.onLine) {
    try {
      const { data, error } = await supabase.from('citizen_reports').upsert([savedReport]).select();
      if (!error && data && data[0]) {
        savedReport = data[0] as CitizenReport;
      }
    } catch (err) {
      console.warn('Supabase save report failed, using local store:', err);
      savedReport.syncStatus = 'pending_sync';
    }
  }

  // Update local memory store
  const current = getLocalStore<CitizenReport[]>('dh_citizen_reports', MOCK_CITIZEN_REPORTS);
  const updated = [savedReport, ...current.filter(r => r.id !== savedReport.id)];
  setLocalStore('dh_citizen_reports', updated);

  return savedReport;
}

export async function savePublicAlert(alert: PublicAlert): Promise<PublicAlert> {
  if (isSupabaseConfigured && navigator.onLine) {
    try {
      await supabase.from('alerts').upsert([alert]);
    } catch (err) {
      console.warn('Supabase save alert failed:', err);
    }
  }
  const current = getLocalStore<PublicAlert[]>('dh_alerts', MOCK_ALERTS);
  const updated = [alert, ...current.filter(a => a.id !== alert.id)];
  setLocalStore('dh_alerts', updated);
  await cachePublicAlerts(updated);
  return alert;
}
