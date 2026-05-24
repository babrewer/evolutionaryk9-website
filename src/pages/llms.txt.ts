import type { APIRoute } from 'astro';
import siteData from '../data/site.json';

export const GET: APIRoute = () => {
  const { site, nav, services } = siteData;
  const base = site.url.replace(/\/$/, '');
  const lines: string[] = [];
  lines.push(`# ${site.name}`);
  lines.push(`> ${site.description}`);
  lines.push('');
  lines.push(`Website: ${site.url}`);
  lines.push(`Phone: ${site.phone}`);
  lines.push(`Email: ${site.email}`);
  lines.push(`Address: ${site.address.streetAddress}, ${site.address.addressLocality}, ${site.address.addressRegion} ${site.address.postalCode}`);
  lines.push(`Facebook: ${site.facebookUrl}`);
  lines.push(`Instagram: ${site.instagramUrl}`);
  lines.push('');
  lines.push('## About');
  lines.push('');
  lines.push("Dogs aren't just pets — dogs are family. Dedicated animal lovers focused on a healthy, fulfilling relationship between canines and their human packs. Owner-operated, licensed facility, onsite 24/7. Serving Blue Ridge, Ellijay, Blairsville, Murphy NC and surrounding North Georgia mountains.");
  lines.push('');
  lines.push('## Services');
  lines.push('');
  for (const s of services) {
    lines.push(`### ${s.name}`);
    lines.push(`- ${s.blurb}`);
    lines.push(`- URL: ${base}${s.href}`);
    lines.push('');
  }
  lines.push('## Pricing snapshot');
  lines.push('');
  lines.push('Boarding: $40 / 1 dog · $75 / 2 dogs · $95 / 3 dogs per night.');
  lines.push('Daycare: $30 / 1 dog · $60 / 2 dogs · $90 / 3 dogs per day. 8am–6pm.');
  lines.push('Spa add-on baths: $30–$90 by size. Nail trim: $15. First-day acclimation fee: $15.');
  lines.push('Training: currently on pause — check back for updates.');
  lines.push('');
  lines.push('## Pages');
  lines.push('');
  for (const n of nav) {
    lines.push(`- [${n.label}](${base}${n.href})`);
  }
  return new Response(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
