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

    const { image, patientName } = req.body as {
      image?: string;
      patientName?: string;
    };

    if (!image || !patientName) {
      throw createError('Faltan parámetros requeridos', 400, 'BAD_REQUEST');
    }

    const base64Data = image.includes(',')
      ? image.split(',')[1]
      : image;

    const prompt = `
Eres un experto en fertilidad y análisis clínicos.
Genera un INFORME NARRATIVO para la paciente "${patientName}".

Analiza los resultados clave del examen a la luz de los rangos de referencia.
El informe debe:
- Ser empático y claro.
- Explicar cualquier resultado fuera de rango (alto/bajo).
- Ofrecer exactamente 3 recomendaciones de estilo de vida para mejorar esos valores.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: prompt },
        {
          inlineData: {
            data: base64Data,
            mimeType: 'image/jpeg',
          },
        },
      ],
    } as any);

    const reportText = (response as any).text ?? 'No se pudo generar el informe.';

    return res.status(200).json({ report: reportText });
  } catch (error) {
    sendErrorResponse(res, error, req);
  }
}


