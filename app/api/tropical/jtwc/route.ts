import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const JTWC_RSS = 'https://www.metoc.navy.mil/jtwc/rss/jtwc.rss';

type JtwcItem = {
  title: string;
  link: string;
  description: string;
  published: string | null;
  source: 'JTWC';
};

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function field(item: string, tag: string): string {
  const match = item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

export async function GET() {
  try {
    const response = await fetch(JTWC_RSS, {
      cache: 'no-store',
      headers: { 'User-Agent': 'MesoVortexWX/1.0 (tropical-data)', Accept: 'application/rss+xml, application/xml' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return NextResponse.json({ available: false, source: 'JTWC', products: [], error: `JTWC feed HTTP ${response.status}` });
    }
    const xml = await response.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    const products: JtwcItem[] = items.map((item) => ({
      title: field(item, 'title') || 'JTWC product',
      link: field(item, 'link'),
      description: field(item, 'description'),
      published: field(item, 'pubDate') || null,
      source: 'JTWC',
    }));
    return NextResponse.json({
      available: products.length > 0,
      source: 'Joint Typhoon Warning Center (JTWC) public RSS',
      url: JTWC_RSS,
      generatedAt: new Date().toISOString(),
      products,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    return NextResponse.json({ available: false, source: 'JTWC', products: [], error: String(err?.message || err) });
  }
}
