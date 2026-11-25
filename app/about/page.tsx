/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import { DATA_SOURCES, type DataSourceEntry, type DataSourceStatus } from '../../lib/data-sources';

function statusClass(status: DataSourceStatus): string {
  if (status === 'IMPLEMENTED') return 'rounded bg-emerald-950 px-1.5 py-0.5 text-[9px] font-black text-emerald-300';
  if (status === 'PARTIAL') return 'rounded bg-sky-950 px-1.5 py-0.5 text-[9px] font-black text-sky-300';
  return 'rounded bg-amber-950 px-1.5 py-0.5 text-[9px] font-black text-amber-300';
}

export const metadata: Metadata = {
  title: 'Credits & About | MesoVortexWX',
  description: 'How MesoVortexWX began, what it aims to provide, and image credit for the March 31, 2023 Little Rock tornado radar imagery.',
};

const AUDIENCES = [
  'Forecasters',
  'Emergency managers',
  'First responders',
  'Pilots',
  'Researchers',
  'Weather enthusiasts',
  'The general public',
];

const EMPHASES = [
  'Data honesty',
  'Transparency',
  'Verification',
  'Accessibility',
  'Weather-first workflows',
];

export default function AboutPage() {
  return (
    <main className="h-screen overflow-y-auto bg-[#050a12] font-sans text-slate-200">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-[#0b1220]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="MesoVortexWX" width={24} height={24} className="rounded-full" />
            <span className="text-sm font-black uppercase tracking-wider text-white">
              MESO<span className="text-sky-400">VORTEX</span> <span className="text-amber-400">WX</span>
            </span>
          </div>
          <a
            href="/"
            className="rounded-md border border-slate-700 px-2.5 py-1 text-[11px] font-bold text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            ← Weather workstation
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">Credits &amp; About</p>
          <h1 className="mt-1 text-xl font-black text-white">Project story</h1>
          <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-slate-300">
            <p>
              MesoVortexWX traces its origins to the March 31, 2023 tornado that impacted the Little Rock
              metropolitan area.
            </p>
            <p>
              Before that event, the creator was not actively studying meteorology or severe-weather forecasting
              in depth. Experiencing the tornado sparked a lasting interest in weather, severe storms, radar
              technology, and meteorology. That interest eventually grew into the development of MesoVortexWX.
            </p>
            <p>
              MesoVortexWX is built for the glory of God and for the benefit of all people. The goal of the project
              is to provide honest, trustworthy, and accessible weather information for forecasters, emergency
              managers, researchers, weather enthusiasts, pilots, and the public.
            </p>
          </div>
        </section>

        <figure className="overflow-hidden rounded-xl border border-slate-700 bg-[#0b1220]">
          <img
            src="/hsi-radar-backdrop.webp"
            alt="Base reflectivity radar imagery from the March 31, 2023 Little Rock tornado"
            width={1020}
            height={807}
            loading="lazy"
            className="block h-auto w-full"
          />
          <figcaption className="space-y-1 border-t border-slate-700 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
            <div className="font-black text-slate-100">March 31, 2023 Little Rock Tornado</div>
            <div>Radar imagery from the tornado that struck the Little Rock metropolitan area on March 31, 2023.</div>
            <div>Image provided by the creator of MesoVortexWX.</div>
          </figcaption>
        </figure>

        <section className="rounded-xl border border-slate-700 bg-[#0b1220] p-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-sky-300">Mission</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
            MesoVortexWX is being built to deliver high-quality weather information for:
          </p>
          <ul className="mt-2 grid gap-1 text-[12px] text-slate-200 sm:grid-cols-2">
            {AUDIENCES.map((item) => <li key={item}>• {item}</li>)}
          </ul>
          <h3 className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-400">The project emphasizes</h3>
          <ul className="mt-2 grid gap-1 text-[12px] text-slate-200 sm:grid-cols-2">
            {EMPHASES.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-700 bg-[#0b1220] p-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-sky-300">Data sources</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
            Verified source registry. Status describes MesoVortexWX implementation, not whether an upstream provider exists.
          </p>
          <div className="mt-3 space-y-4">
            {Array.from(new Set(DATA_SOURCES.map((source) => source.category))).map((category) => (
              <div key={category}>
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-300">{category}</h3>
                <div className="mt-1 divide-y divide-slate-800">
                  {DATA_SOURCES.filter((source: DataSourceEntry) => source.category === category).map((source: DataSourceEntry) => (
                    <div key={source.id} className="py-1.5 text-[11px] leading-snug">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-100">{source.data}</span>
                        <span className={statusClass(source.status)}>{source.status.replaceAll('_', ' ')}</span>
                      </div>
                      <div className="text-slate-400">{source.source}</div>
                      {source.notes && <div className="text-slate-500">{source.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-slate-800 pt-4 text-center text-[11px] leading-relaxed text-slate-400">
          <p>
            &ldquo;He sends the lightning with the rain<br />
            and brings out the wind from his storehouses.&rdquo;<br />
            <span className="text-slate-500">— Psalm 135:7</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
