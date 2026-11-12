import { GoogleGenAI } from '@google/genai';

export const config = { path: '/api/*' };

export default async function handler(request) {
  if (new URL(request.url).pathname !== '/api/assistant') {
    return new Response('Not found', { status: 404 });
  }
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  }
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return new Response('Forbidden', { status: 403 });
  }
  let data;
  try {
    const body = await request.text();
    if (body.length > 16000) return new Response('Request too large', { status: 413 });
    data = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (typeof data?.prompt !== 'string' || !data.prompt.trim() || data.prompt.length > 12000) {
    return new Response('Invalid prompt', { status: 400 });
  }
  try {
    const ai = new GoogleGenAI({});
    const result = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: data.prompt,
      config: {
        systemInstruction: 'Proporciona respuestas profesionales, concisas y basadas en mejores prácticas de RRHH en Ecuador. Si la pregunta es sobre leyes ecuatorianas, menciona que es una guía general.',
        maxOutputTokens: 1500,
        httpOptions: { timeout: 15000 },
      },
    });
    return Response.json({ text: result.text }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'El asistente no está disponible en este momento.' }, { status: 503 });
  }
}
