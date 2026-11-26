/** Operational alert groups. Every entry maps to a real NWS product family. */
export type AlertTypeConfig = {
  id: string;
  label: string;
  match: RegExp;
  color: string;
  tone: 'siren' | 'enhanced' | 'warning' | 'flood' | 'emergency-flood' | 'attention';
  phrase: string;
};

export const ALERT_SECTIONS: readonly { id: string; label: string; types: AlertTypeConfig[] }[] = [
  { id: 'severe', label: 'SEVERE', types: [
    { id: 'tornado-warning', label: 'Tornado Warning', match: /tornado warning/i, color: '#dc2626', tone: 'siren', phrase: 'National Weather Service has issued a Tornado Warning for your monitored area.' },
    { id: 'tornado-watch', label: 'Tornado Watch', match: /tornado watch/i, color: '#eab308', tone: 'attention', phrase: 'National Weather Service has issued a Tornado Watch for your monitored area.' },
    { id: 'severe-thunderstorm-warning', label: 'Severe Thunderstorm Warning', match: /severe thunderstorm warning/i, color: '#f59e0b', tone: 'warning', phrase: 'National Weather Service has issued a Severe Thunderstorm Warning for your monitored area.' },
    { id: 'severe-thunderstorm-watch', label: 'Severe Thunderstorm Watch', match: /severe thunderstorm watch/i, color: '#f59e0b', tone: 'attention', phrase: 'National Weather Service has issued a Severe Thunderstorm Watch for your monitored area.' },
  ] },
  { id: 'flooding', label: 'FLOODING / HYDRO', types: [
    { id: 'flash-flood-warning', label: 'Flash Flood Warning', match: /flash flood warning/i, color: '#059669', tone: 'flood', phrase: 'National Weather Service has issued a Flash Flood Warning for your monitored area.' },
    { id: 'flood-warning', label: 'Flood Warning', match: /^flood warning/i, color: '#10b981', tone: 'flood', phrase: 'National Weather Service has issued a Flood Warning for your monitored area.' },
    { id: 'flood-advisory', label: 'Flood Advisory', match: /flood advisory/i, color: '#34d399', tone: 'attention', phrase: 'National Weather Service has issued a Flood Advisory.' },
    { id: 'flood-watch', label: 'Flood Watch', match: /flood watch/i, color: '#fbbf24', tone: 'attention', phrase: 'National Weather Service has issued a Flood Watch.' },
  ] },
  { id: 'winter', label: 'WINTER', types: [
    { id: 'winter-storm-warning', label: 'Winter Storm Warning', match: /winter storm warning/i, color: '#60a5fa', tone: 'warning', phrase: 'National Weather Service has issued a Winter Storm Warning.' },
    { id: 'blizzard-warning', label: 'Blizzard Warning', match: /blizzard warning/i, color: '#93c5fd', tone: 'warning', phrase: 'National Weather Service has issued a Blizzard Warning.' },
    { id: 'ice-storm-warning', label: 'Ice Storm Warning', match: /ice storm warning/i, color: '#a5b4fc', tone: 'warning', phrase: 'National Weather Service has issued an Ice Storm Warning.' },
    { id: 'winter-weather-advisory', label: 'Winter Weather Advisory', match: /winter weather advisory/i, color: '#7dd3fc', tone: 'attention', phrase: 'National Weather Service has issued a Winter Weather Advisory.' },
  ] },
  { id: 'wind', label: 'WIND', types: [
    { id: 'high-wind-warning', label: 'High Wind Warning', match: /high wind warning/i, color: '#fb923c', tone: 'warning', phrase: 'National Weather Service has issued a High Wind Warning.' },
    { id: 'wind-advisory', label: 'Wind Advisory', match: /wind advisory/i, color: '#fdba74', tone: 'attention', phrase: 'National Weather Service has issued a Wind Advisory.' },
    { id: 'dust-storm-warning', label: 'Dust Storm Warning', match: /dust storm warning/i, color: '#d97706', tone: 'warning', phrase: 'National Weather Service has issued a Dust Storm Warning.' },
  ] },
  { id: 'heat-cold', label: 'HEAT / COLD', types: [
    { id: 'heat-advisory', label: 'Heat Advisory', match: /heat advisory/i, color: '#f97316', tone: 'attention', phrase: 'National Weather Service has issued a Heat Advisory.' },
    { id: 'excessive-heat-warning', label: 'Excessive Heat Warning', match: /excessive heat warning/i, color: '#ef4444', tone: 'warning', phrase: 'National Weather Service has issued an Excessive Heat Warning.' },
    { id: 'freeze-warning', label: 'Freeze Warning', match: /freeze warning/i, color: '#38bdf8', tone: 'warning', phrase: 'National Weather Service has issued a Freeze Warning.' },
    { id: 'frost-advisory', label: 'Frost Advisory', match: /frost advisory/i, color: '#7dd3fc', tone: 'attention', phrase: 'National Weather Service has issued a Frost Advisory.' },
  ] },
  { id: 'fire', label: 'FIRE WEATHER', types: [
    { id: 'red-flag-warning', label: 'Red Flag Warning', match: /red flag warning/i, color: '#ef4444', tone: 'warning', phrase: 'National Weather Service has issued a Red Flag Warning.' },
    { id: 'fire-weather-watch', label: 'Fire Weather Watch', match: /fire weather watch/i, color: '#f97316', tone: 'attention', phrase: 'National Weather Service has issued a Fire Weather Watch.' },
  ] },
  { id: 'tropical', label: 'TROPICAL', types: [
    { id: 'hurricane-warning', label: 'Hurricane Warning', match: /hurricane warning/i, color: '#c026d3', tone: 'siren', phrase: 'National Weather Service has issued a Hurricane Warning.' },
    { id: 'hurricane-watch', label: 'Hurricane Watch', match: /hurricane watch/i, color: '#d946ef', tone: 'attention', phrase: 'National Weather Service has issued a Hurricane Watch.' },
    { id: 'tropical-storm-warning', label: 'Tropical Storm Warning', match: /tropical storm warning/i, color: '#a855f7', tone: 'warning', phrase: 'National Weather Service has issued a Tropical Storm Warning.' },
    { id: 'tropical-storm-watch', label: 'Tropical Storm Watch', match: /tropical storm watch/i, color: '#c084fc', tone: 'attention', phrase: 'National Weather Service has issued a Tropical Storm Watch.' },
  ] },
  { id: 'marine', label: 'MARINE', types: [
    { id: 'marine-warning', label: 'Marine Warnings', match: /marine warning|gale warning|storm warning/i, color: '#0ea5e9', tone: 'warning', phrase: 'National Weather Service has issued a Marine Warning.' },
    { id: 'special-marine-warning', label: 'Special Marine Warnings', match: /special marine warning/i, color: '#0284c7', tone: 'warning', phrase: 'National Weather Service has issued a Special Marine Warning.' },
  ] },
  { id: 'other', label: 'OTHER', types: [
    { id: 'special-weather-statement', label: 'Special Weather Statements', match: /special weather statement/i, color: '#8b5cf6', tone: 'attention', phrase: 'National Weather Service has issued a Special Weather Statement.' },
    { id: 'administrative', label: 'Administrative alerts', match: /administrative|daily weather summary|record/i, color: '#64748b', tone: 'attention', phrase: 'National Weather Service has issued an administrative product.' },
  ] },
];

export const ALERT_TYPES: readonly AlertTypeConfig[] = ALERT_SECTIONS.flatMap((section) => section.types);

export const TEST_ALERTS: readonly { id: string; label: string; event: string; phrase: string; tone: AlertTypeConfig['tone'] }[] = [
  { id: 'test-tornado', label: 'Test Tornado Warning', event: 'Tornado Warning', phrase: 'National Weather Service has issued a Tornado Warning for your monitored area.', tone: 'siren' },
  { id: 'test-confirmed-tornado', label: 'Test Confirmed Tornado Warning', event: 'Confirmed Tornado Warning', phrase: 'National Weather Service has issued a Confirmed Tornado Warning for your monitored area.', tone: 'siren' },
  { id: 'test-pds-tornado', label: 'Test PDS Tornado Warning', event: 'PDS Tornado Warning', phrase: 'National Weather Service has issued a Particularly Dangerous Situation Tornado Warning for your monitored area.', tone: 'enhanced' },
  { id: 'test-tornado-emergency', label: 'Test Tornado Emergency', event: 'Tornado Emergency', phrase: 'National Weather Service has issued a Tornado Emergency for your monitored area.', tone: 'siren' },
  { id: 'test-severe-thunderstorm', label: 'Test Severe Thunderstorm Warning', event: 'Severe Thunderstorm Warning', phrase: 'National Weather Service has issued a Severe Thunderstorm Warning for your monitored area.', tone: 'warning' },
  { id: 'test-flash-flood', label: 'Test Flash Flood Warning', event: 'Flash Flood Warning', phrase: 'National Weather Service has issued a Flash Flood Warning for your monitored area.', tone: 'flood' },
  { id: 'test-flash-flood-emergency', label: 'Test Flash Flood Emergency', event: 'Flash Flood Emergency', phrase: 'National Weather Service has issued a Flash Flood Emergency for your monitored area.', tone: 'emergency-flood' },
];

export function alertTypeForEvent(event: string): AlertTypeConfig | null {
  const e = String(event || '');
  return ALERT_TYPES.find((type) => type.id !== 'marine-warning' && type.match.test(e)) || null;
}

export function isEmergencyEvent(event: string): boolean {
  return /tornado emergency|flash flood emergency|particularly dangerous situation|\bPDS\b|extreme severe thunderstorm/i.test(String(event || ''));
}
