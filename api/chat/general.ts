import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai } from '../lib/ai.js';
import { applySecurityHeaders } from '../lib/security.js';
import { sendErrorResponse, createError } from '../lib/errorHandler.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    applySecurityHeaders(res);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query } = req.body as { query?: string };

    if (!query) {
      throw createError('Falta la pregunta del usuario', 400, 'BAD_REQUEST');
    }

    const systemInstruction =
      'Eres un asistente experto en salud y fertilidad de FertyFit. Sé claro, conciso y empático.';

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'system', parts: [{ text: systemInstruction }] },
        { role: 'user', parts: [{ text: query }] },
      ] as any,
    } as any);

    const answer = (response as any).text ?? 'No se pudo generar una respuesta.';

    return res.status(200).json({ answer });
  } catch (error) {
    sendErrorResponse(res, error, req);
  }
}


