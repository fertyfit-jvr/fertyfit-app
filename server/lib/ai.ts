import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY no está definida en las variables de entorno');
}

// Cliente principal para modelos de texto / visión
export const ai = new GoogleGenAI({
  apiKey,
});

// Helper para obtener un modelo concreto (por defecto, gemini-2.0-flash)
export function getModel(modelName = 'gemini-2.0-flash') {
  // Mantener helper por compatibilidad; actualmente no se usa.
  return (ai as any).models?.get({ model: modelName });
}
