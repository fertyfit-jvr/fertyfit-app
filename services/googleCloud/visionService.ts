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
  examTypeDetected?: string; // Tipo de examen detectado automáticamente
  warnings?: string[];
  errors?: string[];
  confidence?: number;
  isMedicalExam?: boolean;
  error?: string;
}

/**
 * Procesa una imagen con OCR a través de una API HTTP (API route de Vercel).
 * Toda la configuración se hace vía URL de API.
 */
export async function processImageOCR(request: OCRRequest): Promise<OCRResponse> {
  try {
    // 1) Permitir URL personalizada para entorno local/producción (por ejemplo, Vercel deploy o API proxy)
    //    Ejemplo en .env(.local):
    //    VITE_OCR_API_URL="https://tu-app.vercel.app/api/ocr/process"
    const customApiUrl = import.meta.env.VITE_OCR_API_URL;

    // 2) Fallback final: ruta relativa /api/ocr/process (solo funcionará si tienes API route montada)
    const apiUrl = customApiUrl || '/api/ocr/process';
    
    logger.log('🔍 Calling OCR API:', { 
      url: apiUrl, 
      examType: request.examType,
      hasCustomApiUrl: !!customApiUrl
    });
    
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
    
    // Aceptar datos en parsedData o en otros formatos alternativos
    const parsedData = data.parsedData || data.data || (data.parsedData === undefined && Object.keys(data).length > 0 ? data : {});
    
    return {
      text: data.text || data.rawText || '', // Texto extraído o datos estructurados de la API
      parsedData: parsedData,
      examTypeDetected: data.examTypeDetected, // Tipo detectado automáticamente
      warnings: data.warnings || [],
      errors: data.errors || [],
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

