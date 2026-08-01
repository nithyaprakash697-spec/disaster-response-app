export type UserRole = 'citizen' | 'admin';

export type DisasterType = 
  | 'earthquake' 
  | 'flood' 
  | 'cyclone' 
  | 'fire' 
  | 'landslide' 
  | 'storm' 
  | 'tsunami';

export type SeverityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type AgentType = 'detection' | 'resource' | 'communication' | 'citizen';

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  agent: AgentType;
  agentName: string;
  inputSummary: string;
  outputJson: Record<string, any>;
  status: 'processing' | 'completed' | 'failed';
  providerUsed: 'gemini' | 'groq' | 'fallback';
  executionTimeMs?: number;
  offlineSyncTag?: string;
  isDelayed?: boolean;
  delayMinutes?: number;
  resolvedLocationSummary?: string;
}

export interface DisasterEvent {
  id: string;
  type: DisasterType;
  severity: SeverityLevel;
  title: string;
  location: string;
  lat: number;
  lng: number;
  magnitude?: number;
  depth?: number;
  time: string;
  source: 'usgs' | 'open-meteo' | 'manual';
  status: 'active' | 'contained' | 'resolved';
  description?: string;
  affectedCount?: number;
}

export interface ResourceItem {
  id: string;
  name: string;
  type: 'shelter' | 'hospital' | 'rescue_team';
  location: string;
  lat: number;
  lng: number;
  capacity: number;
  occupied: number;
  contact: string;
  status: 'available' | 'full' | 'busy';
  medicalStaff?: number;
  suppliesLevel?: 'High' | 'Medium' | 'Low' | 'Critical';
}

export interface PublicAlert {
  id: string;
  eventId?: string;
  titleEn: string;
  titleTa: string;
  messageEn: string;
  messageTa: string;
  urgency: 'Critical' | 'Warning' | 'Advisory';
  timestamp: string;
  location: string;
  safetyInstructionsEn?: string[];
  safetyInstructionsTa?: string[];
}

export interface CitizenReport {
  id: string;
  citizenName?: string;
  phone?: string;
  rawMessage?: string;
  needs: ('Water' | 'Medical' | 'Trapped' | 'Shelter' | 'Food')[];
  locationName: string;
  lat: number;
  lng: number;
  timestamp: string;
  syncedAt?: string;
  isOfflineSubmission?: boolean;
  status: 'pending' | 'assigned' | 'resolved';
  syncStatus: 'synced' | 'pending_sync';
  agentExtractedInfo?: {
    locationExtracted: string;
    urgencyScore: number;
    dispatchAction: string;
    nearestShelterName?: string;
    distanceToShelterKm?: number;
  };
}

export interface WeatherData {
  temp: number;
  humidity: number;
  precipitation: number;
  rain: number;
  windSpeed: number;
  weatherCode: number;
  condition: string;
  locationName: string;
}
