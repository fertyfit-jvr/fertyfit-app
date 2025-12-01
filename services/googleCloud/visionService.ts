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
    // Always use full URL - in dev it points to Vercel, in prod it's the same domain
    const vercelUrl = import.meta.env.VITE_VERCEL_URL || import.meta.env.NEXT_PUBLIC_VERCEL_URL || 'https://method.fertyfit.com';
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development' || 
      (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));
    const apiUrl = isDev 
      ? `${vercelUrl}/api/ocr/process`
      : (typeof window !== 'undefined' ? `${window.location.origin}/api/ocr/process` : '/api/ocr/process');
    
    logger.log('🔍 Calling OCR API:', { url: apiUrl, examType: request.examType, isDev, vercelUrl });
    
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
      let errorMessage = `Error del servidor (${response.status})`;
      let errorCode = 'API_ERROR';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
        errorCode = errorData.code || errorCode;
        
        // Mensajes específicos según el código de error
        if (errorData.code === 'RATE_LIMIT_EXCEEDED') {
          errorMessage = 'Demasiadas solicitudes. Por favor, espera un momento e intenta de nuevo.';
        } else if (errorData.code === 'INVALID_IMAGE' || errorData.code === 'INVALID_IMAGE_FORMAT') {
          errorMessage = 'Formato de imagen no válido. Por favor, usa JPEG, PNG o WebP.';
        } else if (errorData.code === 'IMAGE_TOO_LARGE') {
          errorMessage = 'La imagen es demasiado grande. El tamaño máximo es 5MB.';
        } else if (errorData.code === 'NO_TEXT_DETECTED') {
          errorMessage = 'No se detectó texto en la imagen. Asegúrate de que la imagen sea clara y contenga texto legible.';
        } else if (errorData.code === 'INSUFFICIENT_TEXT') {
          errorMessage = 'Se detectó muy poco texto. Por favor, toma una foto más completa del examen médico.';
        } else if (errorData.code === 'NO_MEDICAL_EXAM') {
          errorMessage = 'La imagen no parece ser un examen médico válido. Por favor, verifica que sea el tipo de examen correcto.';
        } else if (errorData.code === 'TIMEOUT_ERROR') {
          errorMessage = 'El procesamiento tardó demasiado. Por favor, intenta con una imagen más pequeña o vuelve a intentar.';
        } else if (errorData.code === 'PARSE_ERROR') {
          errorMessage = 'Error al procesar los datos del examen. Por favor, intenta con otra foto más clara.';
        } else if (errorData.code === 'CONFIG_ERROR' || errorData.code === 'VISION_INIT_ERROR') {
          errorMessage = 'Error de configuración del servidor. Por favor, contacta al soporte si el problema persiste.';
        }
        
        logger.error('❌ OCR API Error:', { 
          status: response.status, 
          code: errorCode,
          error: errorData 
        });
      } catch (parseError) {
        const textError = await response.text().catch(() => '');
        if (textError) {
          errorMessage = textError.length > 200 ? textError.substring(0, 200) + '...' : textError;
        } else {
          // Mensajes según el código de estado HTTP
          if (response.status === 400) {
            errorMessage = 'Error en la solicitud. Por favor, verifica que la imagen sea válida.';
          } else if (response.status === 401 || response.status === 403) {
            errorMessage = 'Error de autenticación. Por favor, recarga la página e intenta de nuevo.';
          } else if (response.status === 429) {
            errorMessage = 'Demasiadas solicitudes. Por favor, espera un momento e intenta de nuevo.';
          } else if (response.status === 500 || response.status === 502 || response.status === 503) {
            errorMessage = 'Error del servidor. Por favor, intenta de nuevo en unos momentos.';
          } else if (response.status === 504) {
            errorMessage = 'El servidor tardó demasiado en responder. Por favor, intenta con una imagen más pequeña.';
          }
        }
        logger.error('❌ OCR API Error (no JSON):', { 
          status: response.status, 
          text: textError,
          errorMessage 
        });
      }
      
      return {
        text: '',
        error: errorMessage,
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
    logger.error('❌ Error calling OCR API:', { 
      error,
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      examType: request.examType,
      imageLength: request.image?.length || 0
    });
    
    let errorMessage = 'Error desconocido al conectar con el servidor';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }
    
    // Detectar errores de red/CORS
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('Network request failed')) {
      return {
        text: '',
        error: 'Error de conexión. Verifica tu conexión a internet y que la API esté disponible. Si el problema persiste, intenta recargar la página.',
      };
    }
    
    // Detectar errores CORS específicos
    if (errorMessage.includes('CORS') || errorMessage.includes('Access-Control')) {
      return {
        text: '',
        error: 'Error de configuración del servidor. Por favor, contacta al soporte.',
      };
    }
    
    // Si el error es muy genérico, dar más contexto
    if (errorMessage.toLowerCase().includes('unknown') || errorMessage === 'Error desconocido al conectar con el servidor') {
      errorMessage = 'Error al procesar la imagen. Por favor:\n• Verifica tu conexión a internet\n• Asegúrate de que la imagen sea válida\n• Intenta recargar la página';
    }
    
    return {
      text: '',
      error: errorMessage,
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

