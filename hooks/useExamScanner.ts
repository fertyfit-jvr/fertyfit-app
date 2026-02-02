import { useState } from 'react';
import { processImageOCR } from '../services/googleCloud/visionService';
import { saveExamToConsultationForms } from '../services/examService';
import { logger } from '../lib/logger';
import { useAppStore } from '../store/useAppStore';

export type ExamType =
  | 'hormonal'
  | 'metabolic'
  | 'vitamin_d'
  | 'ecografia'
  | 'hsg'
  | 'espermio';

interface UseExamScannerOptions {
  examType?: ExamType;
  autoDetect?: boolean;
  examName?: string; // Nombre del examen cuando es "Otro"
}

interface UseExamScannerReturn {
  images: string[];
  isProcessing: boolean;
  extractedData: Record<string, any> | null;
  extractedText: string | null;
  error: string | null;
  warnings: string[];
  validationErrors: string[];
  detectedTypes: string[];
  ragExplanation: string | null;
  isGeneratingExplanation: boolean;
  addImages: (newImages: string[]) => void;
  removeImage: (index: number) => void;
  setError: (message: string | null) => void;
  reset: () => void;
  processImage: () => Promise<void>;
}

/**
 * Hook que encapsula la lógica de negocio del escaneo de exámenes:
 * - Procesar imagen vía OCR
 * - Parsear resultados
 * - Guardar exámenes genéricos en BD
 * - Gestionar estados de error, warnings y validación
 */
export function useExamScanner(options: UseExamScannerOptions = {}): UseExamScannerReturn {
  const { examType, autoDetect = false, examName } = options;
  const { user } = useAppStore();

  const [images, setImages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<Record<string, any> | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [detectedTypes, setDetectedTypes] = useState<string[]>([]);
  const [ragExplanation, setRagExplanation] = useState<string | null>(null);
  const [isGeneratingExplanation, setIsGeneratingExplanation] = useState(false);

  const reset = () => {
    setImages([]);
    setExtractedData(null);
    setExtractedText(null);
    setError(null);
    setWarnings([]);
    setValidationErrors([]);
    setDetectedTypes([]);
    setRagExplanation(null);
    setIsGeneratingExplanation(false);
  };

  const addImages = (newImages: string[]) => {
    if (images.length + newImages.length > 5) {
      setError('Máximo 5 imágenes por examen');
      return;
    }
    setImages(prev => [...prev, ...newImages]);
    setError(null);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const processImage = async () => {
    if (images.length === 0) {
      setError('No hay imágenes para procesar');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setExtractedData(null);
    setWarnings([]);
    setValidationErrors([]);

    try {
      // Validar que las imágenes tengan el formato correcto
      const invalidImage = images.find(img => !img.startsWith('data:image/'));
      if (invalidImage) {
        throw new Error('Formato de imagen inválido. Por favor, selecciona imágenes válidas.');
      }

      logger.log('🖼️ Processing images with OCR...', {
        examType: examType || 'auto-detect',
        autoDetect,
        imagesCount: images.length
      });

      const ocrResult = await processImageOCR({
        images,
        examType: examType || 'hormonal'
      });

      logger.log('📄 OCR Result:', {
        hasError: !!ocrResult.error,
        hasText: !!ocrResult.text,
        hasParsedData: !!ocrResult.parsedData,
        textLength: ocrResult.text?.length || 0
      });

      if (ocrResult.error) {
        logger.error('❌ OCR returned error:', ocrResult.error);
        setError(ocrResult.error);
        setIsProcessing(false);
        return;
      }

      if (ocrResult.text) {
        setExtractedText(ocrResult.text);
      }

      // Para ecografías e imágenes médicas, puede que no haya datos estructurados pero sí imagen o hallazgos visuales
      const hasHallazgosVisuales = ocrResult.raw?.hallazgos_visuales || ocrResult.parsedData?.hallazgos_visuales;
      const hasParsedData = ocrResult.parsedData && Object.keys(ocrResult.parsedData).length > 0;

      // Solo validar si no hay imagen, datos ni hallazgos visuales
      if (!hasParsedData && images.length === 0 && !hasHallazgosVisuales) {
        throw new Error(
          'No se pudieron extraer datos estructurados del examen. Por favor, asegúrate de que la imagen sea clara y contenga los resultados visibles.'
        );
      }

      const parsed: Record<string, any> = ocrResult.parsedData || {};
      let finalExamType: string | undefined = examType || ocrResult.examTypeDetected;

      // Si tenemos examType detectado por el backend, usarlo
      if (ocrResult.examTypeDetected) {
        finalExamType = ocrResult.examTypeDetected;
      }

      // Si no hay tipo pero hay imagen, usar tipo genérico
      if (!finalExamType && images.length > 0) {
        finalExamType = 'examen_medico';
      }

      if (ocrResult.warnings && ocrResult.warnings.length > 0) {
        setWarnings(ocrResult.warnings);
        logger.warn('⚠️ OCR warnings:', ocrResult.warnings);
      }
      if (ocrResult.errors && ocrResult.errors.length > 0) {
        setValidationErrors(ocrResult.errors);
        logger.warn('⚠️ OCR validation errors:', ocrResult.errors);
      }

      setExtractedData(parsed);
      logger.log('✅ Image processed successfully', {
        extractedFields: Object.keys(parsed),
        hasText: !!ocrResult.text,
        textLength: ocrResult.text?.length || 0
      });

      // 1) Generar explicación RAG (si aplica) y guardarla en una variable local
      let ragText: string | undefined;

      if ((parsed && Object.keys(parsed).length > 0) || images.length > 0 || hasHallazgosVisuales) {
        if (user?.id) {
          setIsGeneratingExplanation(true);
          try {
            // Mapear los datos extraídos al formato que espera labs-rag (solo valores numéricos)
            const labs: Record<string, number> = {};
            if (parsed && Object.keys(parsed).length > 0) {
              Object.entries(parsed).forEach(([key, value]) => {
                // Extraer nombre del parámetro (ej: function_fsh -> fsh, function_amh -> amh)
                const paramName = key.replace('function_', '').replace('exam_', '').toLowerCase();
                // Convertir a número si es posible
                if (typeof value === 'number') {
                  labs[paramName] = value;
                } else if (typeof value === 'string') {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue)) {
                    labs[paramName] = numValue;
                  }
                }
              });
            }

            logger.log('🔍 Generating RAG explanation...', {
              labsCount: Object.keys(labs).length,
              hasImages: images.length > 0,
              examType: finalExamType
            });

            // Send the first image as proxy context if needed
            const primaryImage = images[0];

            const response = await fetch('/api/analysis/labs-rag', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.id,
                labs: Object.keys(labs).length > 0 ? labs : undefined,
                image: primaryImage || undefined,
                examType: finalExamType || undefined,
                filters: { pillar_category: 'FUNCTION' }
              })
            });

            if (response.ok) {
              const data = await response.json();
              const explanation =
                typeof data.explanation === 'string' && data.explanation.trim().length > 0
                  ? data.explanation
                  : '';

              setRagExplanation(explanation || null);
              ragText = explanation || undefined;
              logger.log('✅ RAG explanation generated successfully');
            } else {
              logger.warn('⚠️ Failed to generate RAG explanation:', response.status);
            }
          } catch (ragError) {
            logger.warn('⚠️ Failed to generate RAG explanation:', ragError);
            // No mostramos error al usuario, solo no mostramos explicación
          } finally {
            setIsGeneratingExplanation(false);
          }
        }
      }

      // 2) Guardar TODOS los exámenes (incluso si solo hay imagen sin datos estructurados),
      //    incluyendo la explicación IA si la tenemos
      if ((parsed && Object.keys(parsed).length > 0) || images.length > 0) {
        if (!user?.id) {
          logger.warn('No hay userId, no se puede guardar el examen');
        } else {
          logger.log('💾 Saving exam to consultation_forms...', { examType: finalExamType });
          try {
            // Si hay un nombre de examen personalizado (caso "Otro"), usarlo como examTypeDetected
            const finalExamTypeWithName = examName || finalExamType;

            const saveResult = await saveExamToConsultationForms(
              user.id,
              parsed,
              examType,
              finalExamTypeWithName,
              ocrResult.text,
              ocrResult.raw,
              ragText
            );
            if (saveResult.success) {
              logger.log('✅ Exam saved successfully', { formId: saveResult.formId });
            } else {
              logger.warn('⚠️ Failed to save exam:', saveResult.error);
            }
          } catch (saveError) {
            logger.error('❌ Error saving exam:', saveError);
          }
        }
      }
    } catch (err: any) {
      logger.error('❌ Error processing exam:', {
        error: err,
        examType,
        imagesCount: images.length,
        errorName: err instanceof Error ? err.name : 'Unknown',
        errorMessage: err instanceof Error ? err.message : String(err)
      });

      let errorMessage = 'Error desconocido al procesar el examen';

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String(err.message);
      }

      if (
        errorMessage.toLowerCase().includes('unknown') ||
        errorMessage === 'Error desconocido al procesar el examen'
      ) {
        errorMessage =
          'Error al procesar el examen. Por favor:\n• Verifica que la imagen sea clara y completa\n• Asegúrate de tener conexión a internet\n• Intenta con otra imagen más nítida';
      }

      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    images,
    isProcessing,
    extractedData,
    extractedText,
    error,
    warnings,
    validationErrors,
    detectedTypes,
    ragExplanation,
    isGeneratingExplanation,
    addImages,
    removeImage,
    setError,
    reset,
    processImage
  };
}
