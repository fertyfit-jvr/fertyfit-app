import { useRef } from 'react';
import { Camera, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { fileToBase64 } from '../../services/googleCloud/visionService';
import { useExamScanner, ExamType } from '../../hooks/useExamScanner';

interface ExamScannerProps {
  examType?: ExamType; // Opcional: si no se proporciona, detecta automáticamente
  onDataExtracted: (data: Record<string, any>) => void;
  onClose: () => void;
  sectionTitle?: string;
  autoDetect?: boolean; // Si true, detecta automáticamente el tipo y extrae todos los valores
}

const EXAM_TYPE_LABELS: Record<string, string> = {
  hormonal: 'Panel Hormonal',
  metabolic: 'Panel Metabólico',
  vitamin_d: 'Vitamina D',
  ecografia: 'Ecografía',
  hsg: 'Histerosalpingografía',
  espermio: 'Espermiograma',
};

export const ExamScanner = ({ examType, onDataExtracted, onClose, sectionTitle, autoDetect = false }: ExamScannerProps) => {
  const {
    image,
    isProcessing,
    extractedData,
    extractedText,
    error,
    warnings,
    validationErrors,
    detectedTypes,
    setImageBase64,
    setError,
    reset,
    processImage
  } = useExamScanner({ examType, autoDetect });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setImageBase64(base64);
      setError(null);
      // El hook ya se encarga de limpiar warnings/validation cuando procesa,
      // aquí solo limpiamos error de selección
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

  const handleConfirm = () => {
    // Confirmar aunque solo tengamos texto, o datos parseados
    if (extractedData || extractedText) {
      onDataExtracted(extractedData || {});
      onClose();
    }
  };

  const handleRetry = () => {
    reset();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#F4F0ED]">
          <div>
            <h3 className="text-lg font-bold text-[#4A4A4A]">
              {autoDetect || !examType 
                ? 'Escanear examen médico' 
                : `Escanear ${sectionTitle || EXAM_TYPE_LABELS[examType]}`}
            </h3>
            <p className="text-xs text-[#5D7180] mt-1">
              {autoDetect || !examType 
                ? 'Toma una foto del examen. Detectaremos automáticamente el tipo y extraeremos todos los valores.'
                : 'Toma una foto nítida del examen médico'}
            </p>
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
          {!image && (
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
              {/* UN SOLO BOTÓN UNIFICADO - Funciona mejor en móvil */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setError(null);
                  fileInputRef.current?.click();
                }}
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#C7958E] rounded-2xl hover:bg-[#F4F0ED] transition-colors active:scale-95 w-full"
              >
                <Camera size={48} className="text-[#C7958E] mb-3" />
                <span className="text-base font-bold text-[#4A4A4A]">Escanear examen</span>
                <span className="text-xs text-[#5D7180] mt-1 text-center">
                  Toca para tomar foto con la cámara o elegir de galería
                </span>
              </button>
              {/* INPUT MEJORADO con capture para móvil */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
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
                      {autoDetect && detectedTypes.length > 0
                        ? `Detectado: ${detectedTypes.map(t => EXAM_TYPE_LABELS[t] || t).join(', ')}. Revisa los valores encontrados.`
                        : 'Revisa los valores encontrados y confirma para rellenar el formulario.'}
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

              {/* Mostrar texto completo extraído */}
              {extractedText && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-800 mb-2">Texto extraído de la imagen:</p>
                  <div className="bg-white rounded-lg p-3 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-[#4A4A4A] whitespace-pre-wrap font-mono">
                      {extractedText}
                    </pre>
                  </div>
                </div>
              )}

              <div className="bg-[#F9F6F4] border border-[#F4F0ED] rounded-2xl p-4 space-y-3 max-h-64 overflow-y-auto">
                {Object.keys(extractedData).length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-[#5D7180] mb-2">
                      No se encontraron datos estructurados en el examen.
                    </p>
                    {extractedText && (
                      <p className="text-xs text-[#5D7180] italic">
                        Revisa el texto extraído arriba para verificar que la imagen sea correcta.
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-[#5D7180] mb-2">Valores extraídos:</p>
                    {Object.entries(extractedData).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center py-2 border-b border-[#F4F0ED] last:border-0">
                        <span className="text-xs font-bold text-[#95706B] uppercase">{key.replace('function_', '')}</span>
                        <span className="text-sm font-semibold text-[#4A4A4A]">{value}</span>
                      </div>
                    ))}
                  </>
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
                  disabled={!extractedText && Object.keys(extractedData).length === 0}
                  className="flex-1 bg-[#5D7180] text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {Object.keys(extractedData).length > 0 ? 'Confirmar y rellenar' : 'Confirmar (solo texto)'}
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

