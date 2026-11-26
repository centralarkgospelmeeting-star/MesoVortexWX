'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_ALERT_SETTINGS, defaultAlertTypePreferences, type AlertSettings, type AlertSoundProfile } from '../lib/alerts/settings';
import { ALERT_SECTIONS, TEST_ALERTS } from '../lib/alerts/categories';
import { playTestAlert } from '../lib/alerts/audio';

type Props = {
  settings: AlertSettings;
  onChange: (next: AlertSettings) => void;
  onClose: () => void;
  onPreviewNotification?: (test: { event: string; label: string; tone: string }) => void;
};

const PROFILES: Array<{ id: AlertSoundProfile; label: string; desc: string }> = [
  { id: 'classic', label: 'Classic', desc: 'Standard alert tone' },
  { id: 'nws', label: 'NWS Style', desc: 'Urgent warning cadence' },
  { id: 'broadcast', label: 'Broadcast', desc: 'Broadcast-style alert' },
  { id: 'minimal', label: 'Minimal', desc: 'Short subtle tone' },
  { id: 'silent', label: 'Silent', desc: 'No alert sounds' },
];

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#111827] px-3 py-2">
      <span className="text-[11px] font-semibold text-slate-200">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-slate-500">{value}</span>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-slate-700 bg-transparent p-0" />
      </span>
    </label>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function UploadRow({ label, value, onUpload, onClear }: { label: string; value?: string; onUpload: (dataUrl: string) => void; onClear: () => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div className="rounded-lg border border-slate-800 bg-[#111827] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold text-slate-200">{label}</div>
          <div className="text-[10px] text-slate-500">{value ? 'Custom audio assigned' : 'Using profile/default sound'}</div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => ref.current?.click()} className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-200 hover:bg-slate-700">Upload</button>
          {value && <button type="button" onClick={onClear} className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-700">Clear</button>}
        </div>
      </div>
      <input ref={ref} type="file" accept=".mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > 1_500_000) { alert('Audio file too large (max 1.5MB).'); e.currentTarget.value=''; return; }
        try { onUpload(await fileToDataUrl(f)); } catch { alert('Could not load audio file.'); }
        e.currentTarget.value = '';
      }} />
    </div>
  );
}

export function AlertSettingsPanel({ settings, onChange, onClose, onPreviewNotification }: Props) {
  const set = (patch: Partial<AlertSettings>) => onChange({ ...settings, ...patch });
  const setPrefs = (id: string, patch: Partial<AlertSettings['categoryPrefs'][string]>) =>
    set({ categoryPrefs: { ...settings.categoryPrefs, [id]: { ...settings.categoryPrefs[id], ...patch } } });
  const restoreDefaults = () => set({
    customSounds: {},
    soundProfile: DEFAULT_ALERT_SETTINGS.soundProfile,
    categoryPrefs: defaultAlertTypePreferences(),
  });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);
  const setColors = (patch: Partial<AlertSettings['colors']>) => set({ colors: { ...settings.colors, ...patch } });
  const setSpeech = (patch: Partial<AlertSettings['speech']>) => set({ speech: { ...settings.speech, ...patch } });
  const setCustomSounds = (patch: Partial<AlertSettings['customSounds']>) => set({ customSounds: { ...settings.customSounds, ...patch } });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#050a12] p-4">
      <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-700 bg-[#0b1220] text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <div className="text-sm font-black text-white">Alert Settings</div>
            <div className="text-[10px] text-slate-500">Integrated alert customization. Stored locally in this browser.</div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onChange(DEFAULT_ALERT_SETTINGS)} className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800">Reset</button>
            <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">✕</button>
          </div>
        </div>

        <div className="grid max-h-[calc(85vh-56px)] overflow-auto p-4 gap-4 md:grid-cols-2">
          <section className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-wider text-sky-400">Notification behavior</div>
              <button type="button" onClick={restoreDefaults} className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800">Restore Default Alert Sounds</button>
            </div>
            <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200">
              <span>Auto-minimize new alert notification</span>
              <input type="checkbox" checked={settings.notificationAutoMinimize} onChange={(e) => set({ notificationAutoMinimize: e.target.checked })} />
            </label>
            <label className="block rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200">
              <div className="flex justify-between"><span>Notification duration</span><span className="text-slate-400">{Math.round(settings.notificationDurationMs / 1000)}s</span></div>
              <input type="range" min={3000} max={30000} step={1000} value={settings.notificationDurationMs} onChange={(e) => set({ notificationDurationMs: Number(e.target.value) })} className="mt-2 w-full" aria-label="Notification duration" />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200">
              <span>Professional emergency boundary effects (can be disabled)</span>
              <input type="checkbox" checked={settings.emergencyEffects} onChange={(e) => set({ emergencyEffects: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200">
              <span>Voice announcements</span>
              <input type="checkbox" checked={settings.speech.enabled} onChange={(e) => setSpeech({ enabled: e.target.checked })} />
            </label>
            <label className="block rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200">
              <div className="mb-1">Alert voice (default: deep, calm, authoritative)</div>
              <select
                value={settings.voiceURI || ''}
                onChange={(e) => set({ voiceURI: e.target.value || null })}
                className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-[11px]"
              >
                <option value="">System default — authoritative profile</option>
                {voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
              </select>
            </label>
            <label className="block rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200">
              <div className="flex justify-between"><span>Voice pitch</span><span className="text-slate-400">{settings.voicePitch.toFixed(1)}</span></div>
              <input type="range" min={0.5} max={1.2} step={0.1} value={settings.voicePitch} onChange={(e) => set({ voicePitch: Number(e.target.value) })} className="mt-2 w-full" aria-label="Alert voice pitch" />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200">
              <span>Active Emergency Mode reminders (Tornado Emergency)</span>
              <input type="checkbox" checked={settings.emergencyReminders} onChange={(e) => set({ emergencyReminders: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200">
              <span>Reminder interval</span>
              <select
                value={settings.reminderIntervalMs}
                onChange={(e) => set({ reminderIntervalMs: Number(e.target.value) })}
                className="rounded bg-slate-950 border border-slate-700 px-2 py-1 text-[11px]"
              >
                <option value={300000}>5 min</option><option value={600000}>10 min</option><option value={900000}>15 min</option>
              </select>
            </label>
          </section>

          <section className="space-y-2 md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-sky-400">Alert categories</div>
            {ALERT_SECTIONS.map((section) => (
              <details key={section.id} className="rounded-lg border border-slate-800 bg-[#111827] p-2">
                <summary className="cursor-pointer text-[11px] font-black uppercase tracking-wider text-slate-300">{section.label}</summary>
                <div className="mt-2 space-y-1">
                  {section.types.map((type) => {
                    const pref = settings.categoryPrefs[type.id] || { enabled: true, notify: true, voice: false, color: type.color, sound: null };
                    return (
                      <div key={type.id} className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 rounded border border-slate-800 bg-[#0b1220] px-2 py-1.5 text-[10px]">
                        <span className="font-semibold text-slate-200">{type.label}</span>
                        <label title="Enabled"><input type="checkbox" checked={pref.enabled} onChange={(e) => setPrefs(type.id, { enabled: e.target.checked })} /> Show</label>
                        <label title="Notification"><input type="checkbox" checked={pref.notify} onChange={(e) => setPrefs(type.id, { notify: e.target.checked })} /> Notify</label>
                        <label title="Voice"><input type="checkbox" checked={pref.voice} onChange={(e) => setPrefs(type.id, { voice: e.target.checked })} /> Voice</label>
                        <input type="color" aria-label={`${type.label} color`} value={pref.color} onChange={(e) => setPrefs(type.id, { color: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-slate-700 bg-transparent p-0" />
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </section>

          <section className="space-y-2 md:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-sky-400">Test alert audio</div>
            <div className="text-[10px] text-slate-500">Plays the configured tone and voice, then shows the exact notification treatment without waiting for a real warning.</div>
            <div className="flex flex-wrap gap-1.5">
              {TEST_ALERTS.map((test) => (
                <button
                  key={test.id}
                  type="button"
                  onClick={() => { playTestAlert(test, settings); onPreviewNotification?.(test); }}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-800"
                >
                  ▶ {test.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-sky-400">Legacy map colors (per-product colors in categories above)</div>
            <ColorRow label="Tornado Warning" value={settings.colors.tornadoWarning} onChange={(v) => setColors({ tornadoWarning: v })} />
            <ColorRow label="Severe Thunderstorm Warning" value={settings.colors.severeThunderstormWarning} onChange={(v) => setColors({ severeThunderstormWarning: v })} />
            <ColorRow label="Flash Flood Warning" value={settings.colors.flashFloodWarning} onChange={(v) => setColors({ flashFloodWarning: v })} />
            <ColorRow label="Severe Weather Statement" value={settings.colors.severeWeatherStatement} onChange={(v) => setColors({ severeWeatherStatement: v })} />
            <ColorRow label="Tornado Watch" value={settings.colors.tornadoWatch} onChange={(v) => setColors({ tornadoWatch: v })} />
            <ColorRow label="Severe Thunderstorm Watch" value={settings.colors.severeThunderstormWatch} onChange={(v) => setColors({ severeThunderstormWatch: v })} />
            <ColorRow label="Advisory Colors" value={settings.colors.advisory} onChange={(v) => setColors({ advisory: v })} />
            <ColorRow label="Statement Colors" value={settings.colors.statement} onChange={(v) => setColors({ statement: v })} />

            <div className="text-[10px] font-black uppercase tracking-wider text-sky-400 pt-2">Sidebar / Display</div>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200"><span>Sidebar pinned by default</span><input type="checkbox" checked={settings.sidebarPinned} onChange={(e)=>set({sidebarPinned:e.target.checked})} /></label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200"><span>Sidebar auto-hide</span><input type="checkbox" checked={settings.sidebarAutoHide} onChange={(e)=>set({sidebarAutoHide:e.target.checked})} /></label>
            <label className="rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200 block">
              <div className="flex items-center justify-between"><span>Alert outline thickness</span><span className="text-slate-400">{settings.outlineThickness}px</span></div>
              <input type="range" min={1} max={6} step={0.5} value={settings.outlineThickness} onChange={(e)=>set({outlineThickness:Number(e.target.value)})} className="mt-2 w-full" />
            </label>
            <label className="rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200 block">
              <div className="mb-1">Warning display behavior</div>
              <select value={settings.warningDisplayBehavior} onChange={(e)=>set({warningDisplayBehavior:e.target.value as any})} className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-[11px]">
                <option value="banner-and-sidebar">Banner and sidebar</option>
                <option value="sidebar-only">Sidebar only</option>
                <option value="banner-only">Banner only</option>
              </select>
            </label>
            <label className="rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200 block">
              <div className="mb-1">Alert filtering</div>
              <select value={settings.filterMode} onChange={(e)=>set({filterMode:e.target.value as any})} className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-[11px]">
                <option value="all">All alerts</option>
                <option value="warnings">Warnings</option>
                <option value="watches">Watches</option>
                <option value="statements">Statements</option>
              </select>
            </label>
            <label className="rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-[11px] font-semibold text-slate-200 block">
              <div className="mb-1">Sidebar sorting</div>
              <select value={settings.sortMode} onChange={(e)=>set({sortMode:e.target.value as any})} className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-[11px]">
                <option value="priority">Highest priority first</option>
                <option value="newest">Newest first</option>
                <option value="expiring">Expiring soonest</option>
              </select>
            </label>
          </section>

          <section className="space-y-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-sky-400 mb-2">Notification Profiles</div>
              <div className="space-y-1">
                {PROFILES.map((p) => (
                  <button key={p.id} type="button" onClick={() => set({ soundProfile: p.id })} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${settings.soundProfile===p.id?'border-sky-600 bg-sky-900/25':'border-slate-800 bg-[#111827] hover:bg-slate-900'}`}>
                    <div><div className="text-[11px] font-bold text-slate-200">{p.label}</div><div className="text-[10px] text-slate-500">{p.desc}</div></div>
                    {settings.soundProfile===p.id && <span className="text-sky-400 text-xs">●</span>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-sky-400 mb-2">Spoken Alerts</div>
              <div className="space-y-1 rounded-lg border border-slate-800 bg-[#111827] p-3 text-[11px]">
                <label className="flex items-center gap-2 font-bold cursor-pointer"><input type="checkbox" checked={settings.speech.enabled} onChange={(e)=>setSpeech({enabled:e.target.checked})} />Spoken Alerts</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.speech.warnings} onChange={(e)=>setSpeech({warnings:e.target.checked})} />Warning Speech</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.speech.statements} onChange={(e)=>setSpeech({statements:e.target.checked})} />Statement Speech</label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={settings.speech.watches} onChange={(e)=>setSpeech({watches:e.target.checked})} />Watch Speech</label>
                <div className="pt-2 text-[10px] text-slate-500 leading-snug">Announces Tornado/Severe Thunderstorm/Flash Flood Warnings, Severe Weather Statements, Tornado/Severe Thunderstorm Watches when enabled. Fog, administrative, and routine non-convective products are never announced.</div>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-sky-400 mb-2">Custom Audio</div>
              <div className="space-y-2">
                <UploadRow label="Global Alert Sound" value={settings.customSounds.global} onUpload={(v)=>setCustomSounds({global:v})} onClear={()=>setCustomSounds({global:undefined})} />
                <UploadRow label="Tornado Warning Sound" value={settings.customSounds.tornadoWarning} onUpload={(v)=>setCustomSounds({tornadoWarning:v})} onClear={()=>setCustomSounds({tornadoWarning:undefined})} />
                <UploadRow label="Severe Thunderstorm Warning Sound" value={settings.customSounds.severeThunderstormWarning} onUpload={(v)=>setCustomSounds({severeThunderstormWarning:v})} onClear={()=>setCustomSounds({severeThunderstormWarning:undefined})} />
                <UploadRow label="Flash Flood Warning Sound" value={settings.customSounds.flashFloodWarning} onUpload={(v)=>setCustomSounds({flashFloodWarning:v})} onClear={()=>setCustomSounds({flashFloodWarning:undefined})} />
                <div className="text-[10px] text-slate-500">Accepts mp3/wav/ogg (max 1.5MB). Stored locally in browser.</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
