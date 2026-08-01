import { GoogleGenAI } from '@google/genai';
import { AgentLogEntry, AgentType, CitizenReport, DisasterType, PublicAlert, ResourceItem, SeverityLevel } from '../types';
import { triggerPushNotificationBroadcast } from './pushNotifications';

// API Keys from Vite environment or system
const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY || import.meta.env.GEMINI_API_KEY || '';
const GROQ_KEY = import.meta.env.VITE_GROQ_KEY || import.meta.env.GROQ_API_KEY || '';

// Initialize Gemini SDK lazily if key is available
function getGeminiClient() {
  if (!GEMINI_KEY) return null;
  try {
    return new GoogleGenAI({ apiKey: GEMINI_KEY });
  } catch (err) {
    console.warn('Gemini client init warning:', err);
    return null;
  }
}

/**
 * Unified AI Caller with AI Fallback Chain:
 * 1. Gemini API (gemini-3.6-flash)
 * 2. Groq API (llama-3.3-70b-versatile / llama3-8b-8192)
 * 3. Smart Rule-Based Fallback
 */
async function callAIFithFallback(
  systemInstruction: string,
  prompt: string,
  fallbackRuleGenerator: () => any
): Promise<{ json: any; provider: 'gemini' | 'groq' | 'fallback'; executionTimeMs: number }> {
  const startTime = Date.now();

  // --- STEP 1: TRY GEMINI ---
  const ai = getGeminiClient();
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          systemInstruction: systemInstruction + '\nReturn ONLY valid JSON without markdown wrapping.',
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text?.trim() || '';
      const cleanJson = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        json: parsed,
        provider: 'gemini',
        executionTimeMs: Date.now() - startTime
      };
    } catch (err) {
      console.warn('Gemini API call failed, attempting fallback to Groq:', err);
    }
  }

  // --- STEP 2: TRY GROQ FALLBACK ---
  if (GROQ_KEY) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemInstruction + ' Return ONLY raw JSON without markdown syntax.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        })
      });

      if (groqRes.ok) {
        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content || '{}';
        const parsed = JSON.parse(content);
        return {
          json: parsed,
          provider: 'groq',
          executionTimeMs: Date.now() - startTime
        };
      }
    } catch (err) {
      console.warn('Groq API call failed, attempting Rule Engine fallback:', err);
    }
  }

  // --- STEP 3: SMART RULE ENGINE FALLBACK ---
  // Guarantees zero latency and 100% uptime reliability
  const fallbackResult = fallbackRuleGenerator();
  return {
    json: fallbackResult,
    provider: 'fallback',
    executionTimeMs: Date.now() - startTime
  };
}


// ==========================================
// AGENT 1: DETECTION AGENT
// ==========================================
export async function runDetectionAgent(inputData: {
  rawTelemetryText?: string;
  disasterType?: DisasterType;
  location?: string;
  magnitude?: number;
  windSpeed?: number;
}): Promise<{ log: AgentLogEntry; output: any }> {
  const agentName = 'Agent 1: Detection Agent';
  const systemInstruction = `You are a Disaster Detection AI Agent. Analyze raw telemetry, seismic, meteorological, or manual emergency inputs. Classify disaster type, severity (Low, Medium, High, Critical), estimated impact radius in km, primary risks, and disaster summary. Output JSON matching schema: { "disasterType": string, "severity": "Low"|"Medium"|"High"|"Critical", "affectedRadiusKm": number, "primaryImpacts": string[], "riskSummary": string, "recommendedUrgency": string }`;

  const prompt = `Input disaster telemetry: ${JSON.stringify(inputData)}`;

  const fallbackRule = () => {
    const mag = inputData.magnitude || 0;
    const wind = inputData.windSpeed || 0;
    const type = inputData.disasterType || 'earthquake';
    
    let severity: SeverityLevel = 'Medium';
    if (mag >= 6.5 || wind >= 90) severity = 'Critical';
    else if (mag >= 5.2 || wind >= 65) severity = 'High';
    else if (mag >= 4.0 || wind >= 40) severity = 'Medium';
    else severity = 'Low';

    return {
      disasterType: type,
      severity,
      affectedRadiusKm: severity === 'Critical' ? 45 : severity === 'High' ? 25 : 10,
      primaryImpacts: [
        'Structural damage risk to unreinforced buildings',
        'Potential road obstruction and localized power outage',
        'Disruption to public transit and drainage channels'
      ],
      riskSummary: `Classified ${severity} ${type} event centered at ${inputData.location || 'Coromandel Region'}.`,
      recommendedUrgency: severity === 'Critical' ? 'Immediate Evacuation' : 'Heightened Alert'
    };
  };

  const res = await callAIFithFallback(systemInstruction, prompt, fallbackRule);

  const log: AgentLogEntry = {
    id: `log-det-${Date.now()}`,
    timestamp: new Date().toISOString(),
    agent: 'detection',
    agentName,
    inputSummary: `Analyzed telemetry for ${inputData.location || 'input event'} (${inputData.disasterType || 'event'})`,
    outputJson: res.json,
    status: 'completed',
    providerUsed: res.provider,
    executionTimeMs: res.executionTimeMs
  };

  return { log, output: res.json };
}


// ==========================================
// AGENT 2: RESOURCE AGENT
// ==========================================
export async function runResourceAgent(
  detectionOutput: any,
  availableResources: ResourceItem[]
): Promise<{ log: AgentLogEntry; output: any }> {
  const agentName = 'Agent 2: Resource Agent';
  const systemInstruction = `You are a Disaster Resource Allocation Agent. Given a detection agent's disaster report and available shelters, hospitals, and rescue teams, match severity and location to allocate necessary resources. Return JSON schema: { "recommendedShelters": string[], "medicalTeamsAssigned": number, "rescueTeamsAssigned": number, "priorityActions": string[], "resourceDeficitWarning": string | null }`;

  const prompt = `Detection Report: ${JSON.stringify(detectionOutput)}. Available Resources: ${JSON.stringify(availableResources.slice(0, 5))}`;

  const fallbackRule = () => {
    const severity = detectionOutput.severity || 'High';
    const shelters = availableResources.filter(r => r.type === 'shelter' && r.status === 'available');
    
    return {
      recommendedShelters: shelters.length > 0 ? shelters.map(s => s.name) : ['Central Emergency Refuge Stadium'],
      medicalTeamsAssigned: severity === 'Critical' ? 8 : 4,
      rescueTeamsAssigned: severity === 'Critical' ? 12 : 5,
      priorityActions: [
        'Dispatch 4 NDRF amphibious rescue boats to low-lying sectors',
        'Stage trauma emergency triage at nearest district hospital',
        'Pre-position 5,000 liters of bottled water and mobile generators'
      ],
      resourceDeficitWarning: severity === 'Critical' ? 'Medical oxygen supplies running below 30% threshold in secondary clinics.' : null
    };
  };

  const res = await callAIFithFallback(systemInstruction, prompt, fallbackRule);

  const log: AgentLogEntry = {
    id: `log-res-${Date.now()}`,
    timestamp: new Date().toISOString(),
    agent: 'resource',
    agentName,
    inputSummary: `Matched ${detectionOutput.severity} severity to ${availableResources.length} shelter & medical assets`,
    outputJson: res.json,
    status: 'completed',
    providerUsed: res.provider,
    executionTimeMs: res.executionTimeMs
  };

  return { log, output: res.json };
}


// ==========================================
// AGENT 3: COMMUNICATION AGENT
// ==========================================
export async function runCommunicationAgent(
  detectionOutput: any,
  resourceOutput: any,
  location: string
): Promise<{ log: AgentLogEntry; alert: PublicAlert }> {
  const agentName = 'Agent 3: Communication Agent';
  const systemInstruction = `You are an Emergency Communication Agent. Generate clear, bilingual (English + Tamil) public emergency alerts with color-coded urgency (Critical, Warning, Advisory) and actionable safety steps. Return JSON schema: { "titleEn": string, "titleTa": string, "messageEn": string, "messageTa": string, "urgency": "Critical"|"Warning"|"Advisory", "safetyInstructionsEn": string[], "safetyInstructionsTa": string[] }`;

  const prompt = `Location: ${location}. Detection Output: ${JSON.stringify(detectionOutput)}. Resource Allocation: ${JSON.stringify(resourceOutput)}`;

  const fallbackRule = () => {
    const sev = detectionOutput.severity || 'High';
    const urgency = sev === 'Critical' ? 'Critical' : sev === 'High' ? 'Warning' : 'Advisory';

    return {
      titleEn: `EMERGENCY ALERT: ${detectionOutput.disasterType?.toUpperCase() || 'DISASTER'} WARNING IN ${location.toUpperCase()}`,
      titleTa: `அவசர எச்சரிக்கை: ${location} பகுதியில் ${detectionOutput.disasterType || 'பேரிடர்'} எச்சரிக்கை`,
      messageEn: `A ${sev} level ${detectionOutput.disasterType || 'emergency'} event has been confirmed in ${location}. Shelters open at ${resourceOutput.recommendedShelters?.[0] || 'designated safe zones'}. Seek high ground immediately.`,
      messageTa: `${location} பகுதியில் பலத்த ${detectionOutput.disasterType || 'பேரிடர்'} எச்சரிக்கை விடுக்கப்பட்டுள்ளது. அருகில் உள்ள நிவாரண முகாம்களுக்குச் செல்லவும்.`,
      urgency,
      safetyInstructionsEn: [
        'Keep emergency phone charged and store drinking water.',
        'Follow instructions from NDRF and coastal authorities.',
        'Do not touch downed power lines or enter flooded subways.'
      ],
      safetyInstructionsTa: [
        'அவசர தொலைபேசி மற்றும் மின்விளக்குகளை சார்ஜ் செய்து வைக்கவும்.',
        'வெள்ளம் சூழ்ந்த பகுதிகளைத் தவிர்க்கவும்.'
      ]
    };
  };

  const res = await callAIFithFallback(systemInstruction, prompt, fallbackRule);

  const alert: PublicAlert = {
    id: `alert-${Date.now()}`,
    titleEn: res.json.titleEn,
    titleTa: res.json.titleTa,
    messageEn: res.json.messageEn,
    messageTa: res.json.messageTa,
    urgency: res.json.urgency || 'Warning',
    timestamp: new Date().toISOString(),
    location,
    safetyInstructionsEn: res.json.safetyInstructionsEn,
    safetyInstructionsTa: res.json.safetyInstructionsTa
  };

  // Trigger real Web Push Notification broadcast across registered citizens
  console.log('[Agent 3: Communication] 📢 Dispatching Web Push notification broadcast for generated alert...');
  try {
    const pushResult = await triggerPushNotificationBroadcast({
      title: alert.titleEn,
      body: alert.messageEn,
      urgency: alert.urgency,
      location: alert.location
    });
    console.log('[Agent 3: Communication] ✅ Web Push broadcast dispatch result:', pushResult);
  } catch (err) {
    console.warn('[Agent 3: Communication] ⚠️ Web Push broadcast failed:', err);
  }

  const log: AgentLogEntry = {
    id: `log-com-${Date.now()}`,
    timestamp: new Date().toISOString(),
    agent: 'communication',
    agentName,
    inputSummary: `Generated bilingual alert (EN + TA) for ${location} with urgency [${alert.urgency}]`,
    outputJson: res.json,
    status: 'completed',
    providerUsed: res.provider,
    executionTimeMs: res.executionTimeMs
  };

  return { log, alert };
}


// ==========================================
// AGENT 4: CITIZEN REPORT AGENT
// ==========================================
export async function runCitizenReportAgent(
  rawText: string,
  userGps?: { lat: number; lng: number }
): Promise<{ log: AgentLogEntry; extractedInfo: any }> {
  const agentName = 'Agent 4: Citizen Report Agent';
  const systemInstruction = `You are a Citizen Emergency Message Parser Agent. Extract specific needs ('Water', 'Medical', 'Trapped', 'Shelter', 'Food'), exact location name, estimated coordinates, urgency score (1-100), and recommended dispatch action from citizen distress messages. Output JSON schema: { "needs": string[], "locationExtracted": string, "urgencyScore": number, "dispatchAction": string }`;

  const prompt = `Citizen Message: "${rawText}". User GPS hint: ${JSON.stringify(userGps)}`;

  const fallbackRule = () => {
    const textLower = rawText.toLowerCase();
    const needs: ('Water' | 'Medical' | 'Trapped' | 'Shelter' | 'Food')[] = [];
    if (textLower.includes('water') || textLower.includes('drink')) needs.push('Water');
    if (textLower.includes('doctor') || textLower.includes('blood') || textLower.includes('hurt') || textLower.includes('medic') || textLower.includes('hospital')) needs.push('Medical');
    if (textLower.includes('trap') || textLower.includes('stuck') || textLower.includes('collapsed') || textLower.includes('rescue')) needs.push('Trapped');
    if (textLower.includes('shelter') || textLower.includes('roof') || textLower.includes('house')) needs.push('Shelter');
    if (textLower.includes('food') || textLower.includes('hungry') || textLower.includes('ration')) needs.push('Food');

    if (needs.length === 0) needs.push('Water', 'Medical');

    const urgencyScore = needs.includes('Trapped') ? 92 : needs.includes('Medical') ? 85 : 70;

    return {
      needs,
      locationExtracted: userGps ? `GPS Pos (${userGps.lat.toFixed(4)}, ${userGps.lng.toFixed(4)})` : 'Extracted from distress call',
      urgencyScore,
      dispatchAction: `Priority dispatch assigned for ${needs.join(', ')} aid.`
    };
  };

  const res = await callAIFithFallback(systemInstruction, prompt, fallbackRule);

  const log: AgentLogEntry = {
    id: `log-cit-${Date.now()}`,
    timestamp: new Date().toISOString(),
    agent: 'citizen',
    agentName,
    inputSummary: `Parsed distress message: "${rawText.slice(0, 45)}..."`,
    outputJson: res.json,
    status: 'completed',
    providerUsed: res.provider,
    executionTimeMs: res.executionTimeMs
  };

  return { log, extractedInfo: res.json };
}


// ==========================================
// FULL MULTI-AGENT PIPELINE EXECUTION
// ==========================================
export async function runFullCooperativePipeline(
  inputData: { location: string; disasterType: DisasterType; rawTelemetryText?: string },
  resources: ResourceItem[]
): Promise<{
  logs: AgentLogEntry[];
  newAlert: PublicAlert;
  detectionOutput: any;
  resourceOutput: any;
}> {
  const logs: AgentLogEntry[] = [];

  // Step 1: Detection Agent
  const detRes = await runDetectionAgent(inputData);
  logs.push(detRes.log);

  // Step 2: Resource Agent (takes Detection output + resources)
  const resRes = await runResourceAgent(detRes.output, resources);
  logs.push(resRes.log);

  // Step 3: Communication Agent (takes Detection + Resource outputs)
  const comRes = await runCommunicationAgent(detRes.output, resRes.output, inputData.location);
  logs.push(comRes.log);

  return {
    logs,
    newAlert: comRes.alert,
    detectionOutput: detRes.output,
    resourceOutput: resRes.output
  };
}
