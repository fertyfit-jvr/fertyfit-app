/**
 * Vision Service
 * Servicio para procesar imágenes con Google Cloud Vision API (OCR)
 */

export interface OCRRequest {
  image: string; // Base64 encoded image
  examType: 'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio';
}

export interface OCRResponse {
  text: string;
  error?: string;
}

/**
 * Procesa una imagen con OCR a través de la API route de Vercel
 */
export async function processImageOCR(request: OCRRequest): Promise<OCRResponse> {
  try {
    const response = await fetch('/api/ocr/process', {
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
      error: data.error,
    };
  } catch (error) {
    console.error('❌ Error calling OCR API:', error);
    return {
      text: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Convierte un File/Blob a base64
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1]; // Remove data:image/...;base64,
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

