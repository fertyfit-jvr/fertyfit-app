/**
 * Gemini Vision Service
 * Servicio para procesar imágenes con Gemini Pro Vision
 */

import { logger } from '../../lib/logger';

export interface GeminiVisionRequest {
  image: string; // Base64 encoded image (data:image/...;base64,...)
}

export interface GeminiVisionResponse {
  detectedType: 'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio' | 'unknown';
  examDate: string | null;
  extractedData: Record<string, {
    value: number | string;
    unit?: string;
    normal?: string;
  }>;
  sanitizedText: string;
  confidence?: number;
  error?: string;
}

/**
 * Procesa una imagen con Gemini Vision a través de la API route de Vercel
 */
export async function processImageWithGeminiVision(
  request: GeminiVisionRequest
): Promise<GeminiVisionResponse> {
  try {
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
    const vercelUrl = import.meta.env.VITE_VERCEL_URL || import.meta.env.NEXT_PUBLIC_VERCEL_URL || 'https://method.fertyfit.com';
    const apiUrl = isDev 
      ? `${vercelUrl}/api/gemini/process-vision`
      : '/api/gemini/process-vision';
    
    logger.log('🔮 Calling Gemini Vision API:', { url: apiUrl });
    
    const startTime = Date.now();
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: request.image,
      }),
    });

    const processingTime = Date.now() - startTime;
    logger.log(`⏱️ Gemini Vision processing time: ${processingTime}ms`);

    if (!response.ok) {
      let errorMessage = `Error del servidor (${response.status})`;
      let errorCode = 'API_ERROR';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        errorCode = errorData.code || errorCode;
        
        if (errorData.code === 'RATE_LIMIT_EXCEEDED') {
          errorMessage = 'Demasiadas solicitudes. Por favor, espera un momento e intenta de nuevo.';
        } else if (errorData.code === 'INVALID_IMAGE' || errorData.code === 'INVALID_IMAGE_FORMAT') {
          errorMessage = 'Formato de imagen no válido. Por favor, usa JPEG, PNG o WebP.';
        } else if (errorData.code === 'IMAGE_TOO_LARGE') {
          errorMessage = 'La imagen es demasiado grande. El tamaño máximo es 10MB.';
        } else if (errorData.code === 'TIMEOUT_ERROR') {
          errorMessage = 'El procesamiento tardó demasiado. Por favor, intenta con una imagen más pequeña o vuelve a intentar.';
        } else if (errorData.code === 'CONFIG_ERROR') {
          errorMessage = 'Error de configuración del servidor. Por favor, contacta al soporte si el problema persiste.';
        }
        
        logger.error('❌ Gemini Vision API Error:', { 
          status: response.status, 
          code: errorCode,
          error: errorData 
        });
      } catch (parseError) {
        const textError = await response.text().catch(() => '');
        if (textError) {
          errorMessage = textError.length > 200 ? textError.substring(0, 200) + '...' : textError;
        } else {
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
        logger.error('❌ Gemini Vision API Error (no JSON):', { 
          status: response.status, 
          text: textError,
          errorMessage 
        });
      }
      
      return {
        detectedType: 'unknown',
        examDate: null,
        extractedData: {},
        sanitizedText: '',
        error: errorMessage,
      };
    }

    const data = await response.json();
    return {
      detectedType: data.detectedType || 'unknown',
      examDate: data.examDate || null,
      extractedData: data.extractedData || {},
      sanitizedText: data.sanitizedText || '',
      confidence: data.confidence || 0.95,
      error: data.error,
    };
  } catch (error) {
    logger.error('❌ Error calling Gemini Vision API:', { 
      error,
      errorName: error instanceof Error ? error.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
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
        detectedType: 'unknown',
        examDate: null,
        extractedData: {},
        sanitizedText: '',
        error: 'Error de conexión. Verifica tu conexión a internet y que la API esté disponible. Si el problema persiste, intenta recargar la página.',
      };
    }
    
    // Detectar errores CORS específicos
    if (errorMessage.includes('CORS') || errorMessage.includes('Access-Control')) {
      return {
        detectedType: 'unknown',
        examDate: null,
        extractedData: {},
        sanitizedText: '',
        error: 'Error de configuración del servidor. Por favor, contacta al soporte.',
      };
    }
    
    // Si el error es muy genérico, dar más contexto
    if (errorMessage.toLowerCase().includes('unknown') || errorMessage === 'Error desconocido al conectar con el servidor') {
      errorMessage = 'Error al procesar la imagen. Por favor:\n• Verifica tu conexión a internet\n• Asegúrate de que la imagen sea válida\n• Intenta recargar la página';
    }
    
    return {
      detectedType: 'unknown',
      examDate: null,
      extractedData: {},
      sanitizedText: '',
      error: errorMessage,
    };
  }
}

