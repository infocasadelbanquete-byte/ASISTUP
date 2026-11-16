import { drizzle } from 'drizzle-orm/netlify-db';
import { desc } from 'drizzle-orm';
import * as schema from '../../db/schema.js';

const db = drizzle({ schema });
const headers = { 'Cache-Control': 'no-store' };
export const config = { path: '/api/*' };

export default async (request: Request) => {
  if (new URL(request.url).pathname !== '/api/saved-reports') {
    return new Response('Not found', { status: 404 });
  }
  try {
    if (request.method === 'GET') {
      return Response.json(await db.select().from(schema.savedReports).orderBy(desc(schema.savedReports.date)), { headers });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });
    }
    if (request.headers.get('origin') && request.headers.get('origin') !== new URL(request.url).origin) {
      return new Response('Forbidden', { status: 403 });
    }
    const body = await request.text();
    if (body.length > 5_000_000) return new Response('Report too large', { status: 413 });
    let report;
    try { report = JSON.parse(body); } catch { return new Response('Invalid JSON', { status: 400 }); }
    if (!report || typeof report !== 'object' ||
      !['id', 'name', 'date', 'content', 'month', 'year'].every(key => typeof report[key] === 'string') ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(report.id) || !report.name || report.name.length > 250 ||
      !Number.isFinite(Date.parse(report.date)) || report.type !== 'payroll' ||
      !/^\d{4}$/.test(report.year)) {
      return new Response('Invalid report', { status: 400 });
    }
    const value = {
      id: report.id, name: report.name, date: report.date, content: report.content,
      type: 'payroll', month: report.month, year: report.year,
    };
    const [saved] = await db.insert(schema.savedReports).values(value)
      .onConflictDoUpdate({ target: schema.savedReports.id, set: value }).returning();
    return Response.json(saved, { status: 201, headers });
  } catch {
    return Response.json({ error: 'No se pudo acceder a las nóminas guardadas.' }, { status: 503, headers });
  }
};
