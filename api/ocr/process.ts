/**
 * Vercel Serverless Function
 * API Route para OCR con Google Cloud Vision
 * POST /api/ocr/process
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Importar Google Cloud Vision (se instalará como dependencia)
let vision: any = null;

async function getVisionClient() {
  if (vision) return vision;

  try {
    // Importar dinámicamente para evitar errores en build
    const { ImageAnnotatorClient } = await import('@google-cloud/vision');
    
    const credentials = process.env.GOOGLE_CLOUD_CREDENTIALS;
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;

    if (!credentials || !projectId) {
      throw new Error('Google Cloud credentials not configured');
    }

    // Parsear credenciales JSON
    const credentialsObj = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;

    vision = new ImageAnnotatorClient({
      projectId,
      credentials: credentialsObj,
    });

    return vision;
  } catch (error) {
    console.error('❌ Error initializing Vision client:', error);
    throw error;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, examType } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    if (!examType) {
      return res.status(400).json({ error: 'Exam type is required' });
    }

    // Obtener cliente de Vision
    const client = await getVisionClient();

    // Convertir base64 a buffer
    const imageBuffer = Buffer.from(image, 'base64');

    // Realizar OCR
    const [result] = await client.textDetection({
      image: { content: imageBuffer },
    });

    const detections = result.textAnnotations;
    if (!detections || detections.length === 0) {
      return res.status(400).json({ error: 'No text detected in image' });
    }

    // El primer elemento contiene todo el texto
    const fullText = detections[0].description || '';

    // Parsear el texto según el tipo de examen
    // Importar parser dinámicamente (desde la raíz del proyecto en Vercel)
    const { parseExam } = await import('../../services/examParsers.js');
    const parsedData = parseExam(fullText, examType);

    return res.status(200).json({
      text: fullText,
      parsedData,
    });
  } catch (error) {
    console.error('❌ Error in OCR API route:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

