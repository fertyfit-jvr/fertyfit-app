import { useRef } from 'react';
import { Camera, X, Loader2, CheckCircle, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { fileToBase64 } from '../../services/googleCloud/visionService';
import { useExamScanner, ExamType } from '../../hooks/useExamScanner';
import { logger } from '../../lib/logger';

interface ExamScannerProps {
  examType?: ExamType; // Opcional: si no se proporciona, detecta automáticamente
  onDataExtracted: (data: Record<string, any>) => void;
  onClose: () => void;
  sectionTitle?: string;
  autoDetect?: boolean; // Si true, detecta automáticamente el tipo y extrae todos los valores
  examName?: string; // Nombre del examen cuando es "Otro"
}

const EXAM_TYPE_LABELS: Record<string, string> = {
  hormonal: 'Panel Hormonal',
  metabolic: 'Panel Metabólico',
  vitamin_d: 'Vitamina D',
  ecografia: 'Ecografía',
  hsg: 'Histerosalpingografía',
  espermio: 'Espermiograma',
};

export const ExamScanner = ({ examType, onDataExtracted, onClose, sectionTitle, autoDetect = false, examName }: ExamScannerProps) => {
  const {
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
  } = useExamScanner({ examType, autoDetect, examName });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const files = event.target.files;
    if (!files || files.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const newImages: string[] = [];

    // Validar tipo de archivo
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        setError('Por favor, selecciona solo imágenes válidas');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    try {
      for (let i = 0; i < files.length; i++) {
        const base64 = await fileToBase64(files[i]);
        newImages.push(base64);
      }

      addImages(newImages);
      // El hook ya valida el máximo de imágenes

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al procesar las imágenes';
      setError(errorMessage);
      logger.error('Error processing images:', err);
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
        <div className="flex items-center justify-between p-6 border-b border-ferty-beige">
          <div>
            <h3 className="text-lg font-bold text-ferty-dark">
              {autoDetect || !examType
                ? 'Escanear examen médico'
                : `Escanear ${sectionTitle || EXAM_TYPE_LABELS[examType]}`}
            </h3>
            <p className="text-xs text-ferty-gray mt-1">
              {autoDetect || !examType
                ? 'Sube fotos del examen. Detectaremos automáticamente el tipo y extraeremos todos los valores.'
                : 'Sube fotos nítidas del examen médico'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ferty-gray hover:bg-ferty-beige p-2 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {images.length === 0 && (
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
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-ferty-rose rounded-2xl hover:bg-ferty-beige transition-colors active:scale-95 w-full"
              >
                <Camera size={48} className="text-ferty-rose mb-3" />
                <span className="text-base font-bold text-ferty-dark">Escanear examen</span>
                <span className="text-xs text-ferty-gray mt-1 text-center">
                  Toca para tomar foto o seleccionar imágenes de la galería (hasta 5)
                </span>
              </button>
              {/* INPUT MEJORADO con multiple */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {images.length > 0 && !extractedData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative rounded-xl overflow-hidden border border-ferty-beige aspect-[3/4] group">
                    <img
                      src={img}
                      alt={`Página ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-md opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar imagen"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                {images.length < 5 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ferty-beige hover:border-ferty-cols aspect-[3/4] bg-ferty-beigeLight hover:bg-ferty-beige transition-colors"
                  >
                    <Plus size={24} className="text-ferty-gray mb-1" />
                    <span className="text-xs font-bold text-ferty-gray">Añadir más</span>
                  </button>
                )}
              </div>

              {/* Hidden input for adding more files */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

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

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    processImage();
                  }}
                  disabled={isProcessing}
                  className="flex-1 bg-ferty-gray text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Procesando {images.length} {images.length === 1 ? 'imagen' : 'imágenes'}...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                      Procesar {images.length} {images.length === 1 ? 'imagen' : 'imágenes'}
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
                  className="px-6 py-3 border border-ferty-beigeBorder rounded-xl font-bold text-ferty-gray hover:bg-ferty-beige disabled:opacity-50"
                >
                  Cancelar
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

              {/* Mostrar texto completo extraído */}
              {extractedText && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-800 mb-2">Texto extraído de la imagen:</p>
                  <div className="bg-white rounded-lg p-3 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-ferty-dark whitespace-pre-wrap font-mono">
                      {extractedText}
                    </pre>
                  </div>
                </div>
              )}

              <div className="bg-ferty-beigeLight border border-ferty-beige rounded-2xl p-4 space-y-3 max-h-64 overflow-y-auto">
                {(() => {
                  const displayEntries = Object.entries(extractedData).filter(([key]) => !key.endsWith('_original'));
                  return displayEntries.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-ferty-gray mb-2">
                        No se encontraron datos estructurados en el examen.
                      </p>
                      {extractedText && (
                        <p className="text-xs text-ferty-gray italic">
                          Revisa el texto extraído arriba para verificar que la imagen sea correcta.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold text-ferty-gray mb-2">Valores extraídos:</p>
                      {displayEntries.map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center py-2 border-b border-ferty-beige last:border-0">
                          <span className="text-xs font-bold text-ferty-coral uppercase">{key.replace('function_', '')}</span>
                          <span className="text-sm font-semibold text-ferty-dark">{value}</span>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>

              {/* Mostrar explicación RAG si está disponible */}
              {ragExplanation && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-800 mb-2">Explicación de resultados:</p>
                  <div className="bg-white rounded-lg p-3 max-h-64 overflow-y-auto">
                    <p className="text-xs text-ferty-dark whitespace-pre-wrap leading-relaxed">{ragExplanation}</p>
                  </div>
                </div>
              )}

              {/* Mostrar indicador de carga mientras se genera la explicación */}
              {isGeneratingExplanation && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-blue-600" />
                    <p className="text-xs text-blue-800">Generando explicación de resultados...</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleConfirm();
                  }}
                  disabled={!extractedText && Object.keys(extractedData).length === 0}
                  className="flex-1 bg-ferty-gray text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="px-6 py-3 border border-ferty-beigeBorder rounded-xl font-bold text-ferty-gray hover:bg-ferty-beige"
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
