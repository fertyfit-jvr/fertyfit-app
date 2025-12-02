import { useState } from 'react';
import { processImageOCR } from '../services/googleCloud/visionService';
import { parseExam, parseAllExamTypes, detectExamType } from '../services/examParsers';
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
}

interface UseExamScannerReturn {
  image: string | null;
  isProcessing: boolean;
  extractedData: Record<string, any> | null;
  extractedText: string | null;
  error: string | null;
  warnings: string[];
  validationErrors: string[];
  detectedTypes: string[];
  setImageBase64: (base64: string | null) => void;
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
  const { examType, autoDetect = false } = options;
  const { user } = useAppStore();

  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<Record<string, any> | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [detectedTypes, setDetectedTypes] = useState<string[]>([]);

  const reset = () => {
    setImage(null);
    setExtractedData(null);
    setExtractedText(null);
    setError(null);
    setWarnings([]);
    setValidationErrors([]);
    setDetectedTypes([]);
  };

  const processImage = async () => {
    if (!image) {
      setError('No hay imagen para procesar');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setExtractedData(null);
    setWarnings([]);
    setValidationErrors([]);

    try {
      // Validar que la imagen tenga el formato correcto
      if (!image.startsWith('data:image/')) {
        throw new Error('Formato de imagen inválido. Por favor, selecciona una imagen válida.');
      }

      logger.log('🖼️ Processing image with OCR...', {
        examType: examType || 'auto-detect',
        autoDetect,
        imageLength: image.length,
        imagePreview: image.substring(0, 50) + '...'
      });

      const ocrResult = await processImageOCR({
        image,
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

      if (!ocrResult.text && !ocrResult.parsedData) {
        throw new Error(
          'No se pudo extraer texto de la imagen. Por favor, asegúrate de que la imagen sea clara y contenga texto legible.'
        );
      }

      let parsed: Record<string, any> = {};
      let detectedTypesList: string[] = [];
      let finalExamType: string | undefined = examType || ocrResult.examTypeDetected;

      if (autoDetect || !examType) {
        logger.log('🔍 Auto-detecting exam type and parsing all types...');
        const detection = detectExamType(ocrResult.text || '');
        detectedTypesList = detection.types;
        setDetectedTypes(detectedTypesList);
        logger.log('✅ Detected exam types:', detectedTypesList, 'confidence:', detection.confidence);

        parsed = parseAllExamTypes(ocrResult.text || '');
        logger.log('📝 Parsed all exam types, found fields:', Object.keys(parsed));
      } else if (ocrResult.parsedData && Object.keys(ocrResult.parsedData).length > 0) {
        parsed = ocrResult.parsedData;
        finalExamType = ocrResult.examTypeDetected || examType;
        logger.log('✅ Using parsed data from API', { examTypeDetected: ocrResult.examTypeDetected });
      } else if (ocrResult.text) {
        logger.log('📝 Parsing text locally for type:', examType);
        parsed = parseExam(ocrResult.text, examType);
      }

      // Guardar examen genérico si aplica
      const predefinedTypes = ['hormonal', 'metabolico', 'vitamin_d', 'ecografia', 'hsg', 'espermio'];
      const isGenericExam =
        finalExamType && !predefinedTypes.includes(finalExamType.toLowerCase());

      if (isGenericExam && parsed && Object.keys(parsed).length > 0 && user?.id) {
        logger.log('💾 Saving generic exam to consultation_forms...', { examType: finalExamType });
        try {
          const saveResult = await saveExamToConsultationForms(
            user.id,
            parsed,
            examType,
            finalExamType,
            ocrResult.text
          );
          if (saveResult.success) {
            logger.log('✅ Generic exam saved successfully', { formId: saveResult.formId });
          } else {
            logger.warn('⚠️ Failed to save generic exam:', saveResult.error);
          }
        } catch (saveError) {
          logger.error('❌ Error saving generic exam:', saveError);
        }
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
    } catch (err: any) {
      logger.error('❌ Error processing exam:', {
        error: err,
        examType,
        hasImage: !!image,
        imageLength: image?.length,
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
    image,
    isProcessing,
    extractedData,
    extractedText,
    error,
    warnings,
    validationErrors,
    detectedTypes,
    setImageBase64: setImage,
    setError,
    reset,
    processImage
  };
}


