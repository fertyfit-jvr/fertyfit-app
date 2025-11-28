/**
 * ExamScanner Component
 * Componente para escanear exámenes médicos con OCR
 */

import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { processImageOCR, fileToBase64 } from '../../services/googleCloud/visionService';
import { parseExam } from '../../services/examParsers';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecciona una imagen válida');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setImage(base64);
      setError(null);
    } catch (err) {
      setError('Error al procesar la imagen');
      console.error(err);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      setError('No se pudo acceder a la cámara');
      console.error(err);
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

      // Parsear el texto extraído
      const parsed = parseExam(ocrResult.text, examType);

      setExtractedData(parsed);
    } catch (err) {
      setError('Error al procesar el examen. Intenta de nuevo.');
      console.error(err);
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
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={startCamera}
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#C7958E] rounded-2xl hover:bg-[#F4F0ED] transition-colors"
                >
                  <Camera size={32} className="text-[#C7958E] mb-2" />
                  <span className="text-sm font-bold text-[#4A4A4A]">Tomar foto</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#C7958E] rounded-2xl hover:bg-[#F4F0ED] transition-colors"
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
                  onClick={capturePhoto}
                  className="flex-1 bg-[#5D7180] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Camera size={20} />
                  Capturar
                </button>
                <button
                  onClick={stopCamera}
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
                  src={`data:image/jpeg;base64,${image}`}
                  alt="Examen escaneado"
                  className="w-full h-auto"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-800">Error</p>
                    <p className="text-xs text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={processImage}
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
                  onClick={handleRetry}
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

              <div className="bg-[#F9F6F4] border border-[#F4F0ED] rounded-2xl p-4 space-y-3 max-h-64 overflow-y-auto">
                {Object.keys(extractedData).length === 0 ? (
                  <p className="text-sm text-[#5D7180] text-center py-4">
                    No se encontraron datos en el examen. Intenta con otra foto.
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
                  onClick={handleConfirm}
                  disabled={Object.keys(extractedData).length === 0}
                  className="flex-1 bg-[#5D7180] text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirmar y rellenar
                </button>
                <button
                  onClick={handleRetry}
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

