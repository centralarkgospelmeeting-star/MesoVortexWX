'use client';

import { useRef } from 'react';
import { DEFAULT_ALERT_SETTINGS, type AlertSettings, type AlertSoundProfile } from '../lib/alerts/settings';

type Props = {
  settings: AlertSettings;
  onChange: (next: AlertSettings) => void;
  onClose: () => void;
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

export function AlertSettingsPanel({ settings, onChange, onClose }: Props) {
  const set = (patch: Partial<AlertSettings>) => onChange({ ...settings, ...patch });
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
          <section className="space-y-2">
            <div className="text-[10px] font-black uppercase tracking-wider text-sky-400">Alert Colors</div>
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
