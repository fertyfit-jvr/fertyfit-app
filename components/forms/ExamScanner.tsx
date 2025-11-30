/**
 * ExamScanner Component
 * Componente para escanear exámenes médicos con OCR
 */

import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { processImageOCR, fileToBase64 } from '../../services/googleCloud/visionService';
import { parseExam } from '../../services/examParsers';
import { logger } from '../../lib/logger';

interface ExamScannerProps {
  examType: 'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio';
  onDataExtracted: (data: Record<string, any>) => void;
  onClose: () => void;
  sectionTitle?: string;
}

const EXAM_TYPE_LABELS: Record<string, string> = {
  hormonal: 'Panel Hormonal',
  metabolic: 'Panel Metabólico',
  vitamin_d: 'Vitamina D',
  ecografia: 'Ecografía',
  hsg: 'Histerosalpingografía',
  espermio: 'Espermiograma',
};

export const ExamScanner = ({ examType, onDataExtracted, onClose, sectionTitle }: ExamScannerProps) => {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<Record<string, any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    const file = event.target.files?.[0];
    if (!file) {
      // Resetear el input si no hay archivo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecciona una imagen válida');
      // Resetear el input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setImage(base64);
      setError(null);
      setWarnings([]);
      setValidationErrors([]);
      // Resetear el input para permitir seleccionar el mismo archivo de nuevo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al procesar la imagen';
      setError(errorMessage);
      logger.error('Error processing image:', err);
      // Resetear el input en caso de error
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const startCamera = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Limpiar errores previos
    setError(null);
    setWarnings([]);
    setValidationErrors([]);
    
    try {
      // Verificar si getUserMedia está disponible
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta el acceso a la cámara. Por favor, usa un navegador moderno o la app móvil.');
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
        setError(null); // Asegurar que no hay error
      }
    } catch (err: any) {
      let errorMessage = 'No se pudo acceder a la cámara';
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Permisos de cámara denegados. Por favor, permite el acceso a la cámara en la configuración de tu navegador.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'No se encontró ninguna cámara. Por favor, conecta una cámara y vuelve a intentar.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'La cámara está siendo usada por otra aplicación. Por favor, cierra otras aplicaciones que usen la cámara.';
      } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        errorMessage = 'La cámara no soporta las características requeridas. Intenta con otra cámara.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      logger.error('Error accessing camera:', { error: err, name: err.name, message: err.message });
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob(async (blob) => {
        if (blob) {
          const base64 = await fileToBase64(blob);
          setImage(base64);
          stopCamera();
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const processImage = async () => {
    if (!image) return;

    setIsProcessing(true);
    setError(null);
    setExtractedData(null);
    setWarnings([]);
    setValidationErrors([]);

    try {
      // Llamar a la API de OCR
      const ocrResult = await processImageOCR({
        image,
        examType,
      });

      if (ocrResult.error) {
        setError(ocrResult.error);
        setIsProcessing(false);
        return;
      }

      // Usar datos parseados de la API si están disponibles, sino parsear localmente
      const parsed = ocrResult.parsedData || parseExam(ocrResult.text, examType);

      // Mostrar advertencias y errores de validación si vienen de la API
      if (ocrResult.warnings && ocrResult.warnings.length > 0) {
        setWarnings(ocrResult.warnings);
      }
      if (ocrResult.errors && ocrResult.errors.length > 0) {
        setValidationErrors(ocrResult.errors);
      }

      setExtractedData(parsed);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al procesar el examen';
      setError(errorMessage);
      logger.error('Error processing exam:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (extractedData) {
      onDataExtracted(extractedData);
      onClose();
    }
  };

  const handleRetry = () => {
    setImage(null);
    setExtractedData(null);
    setError(null);
    setWarnings([]);
    setValidationErrors([]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#F4F0ED]">
          <div>
            <h3 className="text-lg font-bold text-[#4A4A4A]">
              Escanear {sectionTitle || EXAM_TYPE_LABELS[examType]}
            </h3>
            <p className="text-xs text-[#5D7180] mt-1">Toma una foto nítida del examen médico</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#5D7180] hover:bg-[#F4F0ED] p-2 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {!image && !showCamera && (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-red-800">Error</p>
                      <div className="text-xs text-red-700 mt-1 whitespace-pre-line">{error}</div>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startCamera(e);
                  }}
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#C7958E] rounded-2xl hover:bg-[#F4F0ED] transition-colors active:scale-95"
                >
                  <Camera size={32} className="text-[#C7958E] mb-2" />
                  <span className="text-sm font-bold text-[#4A4A4A]">Tomar foto</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setError(null); // Limpiar errores previos
                    fileInputRef.current?.click();
                  }}
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#C7958E] rounded-2xl hover:bg-[#F4F0ED] transition-colors active:scale-95"
                >
                  <Upload size={32} className="text-[#C7958E] mb-2" />
                  <span className="text-sm font-bold text-[#4A4A4A]">Subir imagen</span>
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {showCamera && (
            <div className="space-y-4">
              <div className="relative bg-black rounded-2xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-auto"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    capturePhoto();
                  }}
                  className="flex-1 bg-[#5D7180] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Camera size={20} />
                  Capturar
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    stopCamera();
                  }}
                  className="px-6 py-3 border border-[#E1D7D3] rounded-xl font-bold text-[#5D7180] hover:bg-[#F4F0ED]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {image && !extractedData && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-[#F4F0ED]">
                <img
                  src={image}
                  alt="Examen escaneado"
                  className="w-full h-auto"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-red-800">Error al procesar</p>
                      <div className="text-xs text-red-700 mt-1 whitespace-pre-line">{error}</div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    processImage();
                  }}
                  disabled={isProcessing}
                  className="flex-1 bg-[#5D7180] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      Procesar examen
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRetry();
                  }}
                  disabled={isProcessing}
                  className="px-6 py-3 border border-[#E1D7D3] rounded-xl font-bold text-[#5D7180] hover:bg-[#F4F0ED] disabled:opacity-50"
                >
                  Cambiar foto
                </button>
              </div>
            </div>
          )}

          {extractedData && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                <div className="flex items-start gap-3">
                  <CheckCircle size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-emerald-800">Datos extraídos</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Revisa los valores encontrados y confirma para rellenar el formulario.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mostrar advertencias de validación */}
              {warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-amber-800">Advertencias:</p>
                  </div>
                  {warnings.map((warning, idx) => (
                    <p key={idx} className="text-xs text-amber-700 ml-6">{warning}</p>
                  ))}
                </div>
              )}

              {/* Mostrar errores de validación */}
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-red-800">Valores fuera de rango:</p>
                  </div>
                  {validationErrors.map((err, idx) => (
                    <p key={idx} className="text-xs text-red-700 ml-6">{err}</p>
                  ))}
                  <p className="text-xs text-red-600 mt-2 ml-6 italic">
                    Estos valores no se incluirán. Por favor, verifica el examen original.
                  </p>
                </div>
              )}

              <div className="bg-[#F9F6F4] border border-[#F4F0ED] rounded-2xl p-4 space-y-3 max-h-64 overflow-y-auto">
                {Object.keys(extractedData).length === 0 ? (
                  <p className="text-sm text-[#5D7180] text-center py-4">
                    No se encontraron datos válidos en el examen. Intenta con otra foto.
                  </p>
                ) : (
                  Object.entries(extractedData).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center py-2 border-b border-[#F4F0ED] last:border-0">
                      <span className="text-xs font-bold text-[#95706B] uppercase">{key.replace('function_', '')}</span>
                      <span className="text-sm font-semibold text-[#4A4A4A]">{value}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleConfirm();
                  }}
                  disabled={Object.keys(extractedData).length === 0}
                  className="flex-1 bg-[#5D7180] text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirmar y rellenar
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRetry();
                  }}
                  className="px-6 py-3 border border-[#E1D7D3] rounded-xl font-bold text-[#5D7180] hover:bg-[#F4F0ED]"
                >
                  Escanear de nuevo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

