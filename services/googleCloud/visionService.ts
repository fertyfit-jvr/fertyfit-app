/**
 * Vision Service
 * Servicio para procesar imágenes con Google Cloud Vision API (OCR)
 */

import { logger } from '../../lib/logger';

export interface OCRRequest {
  image: string; // Base64 encoded image
  examType: 'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio';
}

export interface OCRResponse {
  text: string;
  parsedData?: Record<string, any>;
  warnings?: string[];
  errors?: string[];
  confidence?: number;
  isMedicalExam?: boolean;
  error?: string;
}

/**
 * Procesa una imagen con OCR a través de la API route de Vercel
 */
export async function processImageOCR(request: OCRRequest): Promise<OCRResponse> {
  try {
    // En desarrollo, usar URL de producción de Vercel
    // En producción, usar ruta relativa
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
    const vercelUrl = import.meta.env.VITE_VERCEL_URL || import.meta.env.NEXT_PUBLIC_VERCEL_URL || 'https://method.fertyfit.com';
    const apiUrl = isDev 
      ? `${vercelUrl}/api/ocr/process`
      : '/api/ocr/process';
    
    logger.log('🔍 Calling OCR API:', { url: apiUrl, examType: request.examType });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: request.image,
        examType: request.examType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        text: '',
        error: errorData.error || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      text: data.text || '',
      parsedData: data.parsedData,
      warnings: data.warnings,
      errors: data.errors,
      confidence: data.confidence,
      isMedicalExam: data.isMedicalExam,
      error: data.error,
    };
  } catch (error) {
    logger.error('❌ Error calling OCR API:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Convierte un File/Blob a base64
 * Devuelve el formato completo data:image/...;base64,xxx para compatibilidad con la API
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (!result) {
        reject(new Error('Error al leer el archivo'));
        return;
      }
      // Devolver el formato completo data:image/...;base64,xxx
      resolve(result);
    };
    reader.onerror = (error) => {
      reject(new Error('Error al procesar la imagen: ' + (error.target?.error?.message || 'Error desconocido')));
    };
    reader.readAsDataURL(file);
  });
}

