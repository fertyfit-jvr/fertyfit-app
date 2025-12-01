/**
 * ExamComparisonTester Component
 * Componente para probar y comparar OCR vs Gemini Vision
 */

import { useState, useRef } from 'react';
import { Camera, X, Loader2, CheckCircle, AlertCircle, Clock, DollarSign, Zap } from 'lucide-react';
import { processImageOCR, fileToBase64 } from '../../services/googleCloud/visionService';
import { processImageWithGeminiVision } from '../../services/googleCloud/geminiVisionService';
import { logger } from '../../lib/logger';

interface ExamComparisonTesterProps {
  onClose: () => void;
}

interface ComparisonResult {
  method: 'OCR' | 'Gemini Vision';
  success: boolean;
  processingTime: number;
  detectedType?: string;
  extractedData: Record<string, any>;
  extractedText?: string;
  error?: string;
  cost?: number; // Costo estimado en USD
}

export const ExamComparisonTester = ({ onClose }: ExamComparisonTesterProps) => {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<ComparisonResult | null>(null);
  const [geminiResult, setGeminiResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    const file = event.target.files?.[0];
    if (!file) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecciona una imagen válida');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setImage(base64);
      setError(null);
      setOcrResult(null);
      setGeminiResult(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al procesar la imagen';
      setError(errorMessage);
      logger.error('Error processing image:', err);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const processBoth = async () => {
    if (!image) {
      setError('No hay imagen para procesar');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setOcrResult(null);
    setGeminiResult(null);

    // Procesar ambas en paralelo
    const ocrPromise = processOCR();
    const geminiPromise = processGeminiVision();

    // Esperar ambas respuestas
    await Promise.allSettled([ocrPromise, geminiPromise]);
    setIsProcessing(false);
  };

  const processOCR = async (): Promise<void> => {
    const startTime = Date.now();
    
    try {
      // Usar un tipo de examen por defecto para OCR (requiere examType)
      const result = await processImageOCR({
        image: image!,
        examType: 'hormonal', // Tipo por defecto para la prueba
      });

      const processingTime = Date.now() - startTime;

      if (result.error) {
        setOcrResult({
          method: 'OCR',
          success: false,
          processingTime,
          extractedData: {},
          error: result.error,
          cost: 0.0015, // ~$0.0015 por imagen
        });
        return;
      }

      setOcrResult({
        method: 'OCR',
        success: true,
        processingTime,
        extractedData: result.parsedData || {},
        extractedText: result.text,
        cost: 0.0015,
      });
    } catch (err: any) {
      const processingTime = Date.now() - startTime;
      setOcrResult({
        method: 'OCR',
        success: false,
        processingTime,
        extractedData: {},
        error: err.message || 'Error desconocido',
        cost: 0.0015,
      });
    }
  };

  const processGeminiVision = async (): Promise<void> => {
    const startTime = Date.now();
    
    try {
      const result = await processImageWithGeminiVision({
        image: image!,
      });

      const processingTime = Date.now() - startTime;

      if (result.error) {
        setGeminiResult({
          method: 'Gemini Vision',
          success: false,
          processingTime,
          detectedType: result.detectedType,
          extractedData: {},
          error: result.error,
          cost: 0.015, // ~$0.015 por imagen
        });
        return;
      }

      setGeminiResult({
        method: 'Gemini Vision',
        success: true,
        processingTime,
        detectedType: result.detectedType,
        extractedData: result.extractedData || {},
        extractedText: result.sanitizedText,
        cost: 0.015,
      });
    } catch (err: any) {
      const processingTime = Date.now() - startTime;
      setGeminiResult({
        method: 'Gemini Vision',
        success: false,
        processingTime,
        detectedType: 'unknown',
        extractedData: {},
        error: err.message || 'Error desconocido',
        cost: 0.015,
      });
    }
  };

  const handleRetry = () => {
    setImage(null);
    setOcrResult(null);
    setGeminiResult(null);
    setError(null);
  };

  // Calcular costos para 100 usuarios
  const calculateCosts = () => {
    const users = 100;
    const examsPerUser10 = 10;
    const examsPerUser20 = 20;
    
    const totalExams10 = users * examsPerUser10;
    const totalExams20 = users * examsPerUser20;
    
    return {
      ocr10: totalExams10 * 0.0015,
      ocr20: totalExams20 * 0.0015,
      gemini10: totalExams10 * 0.015,
      gemini20: totalExams20 * 0.015,
    };
  };

  const costs = calculateCosts();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#F4F0ED]">
          <div>
            <h3 className="text-lg font-bold text-[#4A4A4A]">
              Comparación OCR vs Gemini Vision
            </h3>
            <p className="text-xs text-[#5D7180] mt-1">Prueba ambas opciones y compara resultados</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#5D7180] hover:bg-[#F4F0ED] p-2 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Costos estimados */}
        <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-[#F4F0ED]">
          <h4 className="text-sm font-bold text-[#4A4A4A] mb-3">💰 Costos estimados (100 usuarios/mes)</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-white p-3 rounded-xl border border-blue-200">
              <p className="font-bold text-blue-800 mb-1">OCR (10 exámenes/usuario)</p>
              <p className="text-2xl font-bold text-blue-600">${costs.ocr10.toFixed(2)}</p>
              <p className="text-[#5D7180] mt-1">≈ {costs.ocr10.toFixed(2)}€/mes</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-purple-200">
              <p className="font-bold text-purple-800 mb-1">Gemini Vision (10 exámenes/usuario)</p>
              <p className="text-2xl font-bold text-purple-600">${costs.gemini10.toFixed(2)}</p>
              <p className="text-[#5D7180] mt-1">≈ {costs.gemini10.toFixed(2)}€/mes</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-blue-200">
              <p className="font-bold text-blue-800 mb-1">OCR (20 exámenes/usuario)</p>
              <p className="text-2xl font-bold text-blue-600">${costs.ocr20.toFixed(2)}</p>
              <p className="text-[#5D7180] mt-1">≈ {costs.ocr20.toFixed(2)}€/mes</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-purple-200">
              <p className="font-bold text-purple-800 mb-1">Gemini Vision (20 exámenes/usuario)</p>
              <p className="text-2xl font-bold text-purple-600">${costs.gemini20.toFixed(2)}</p>
              <p className="text-[#5D7180] mt-1">≈ {costs.gemini20.toFixed(2)}€/mes</p>
            </div>
          </div>
          <p className="text-xs text-[#5D7180] mt-3 text-center">
            💡 Con usuarios de pago a 39.90€/mes: Ingresos = 3,990€/mes | Costo Gemini (10 exámenes) = {costs.gemini10.toFixed(2)}€/mes | Margen = 99.6%
          </p>
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
                <span className="text-base font-bold text-[#4A4A4A]">Subir imagen de prueba</span>
                <span className="text-xs text-[#5D7180] mt-1 text-center">
                  Toca para tomar foto con la cámara o elegir de galería
                </span>
              </button>
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

          {image && !ocrResult && !geminiResult && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-[#F4F0ED]">
                <img
                  src={image}
                  alt="Examen de prueba"
                  className="w-full h-auto"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={processBoth}
                  disabled={isProcessing}
                  className="flex-1 bg-[#5D7180] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Procesando ambas...
                    </>
                  ) : (
                    <>
                      <Zap size={20} />
                      Procesar con OCR y Gemini Vision
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isProcessing}
                  className="px-6 py-3 border border-[#E1D7D3] rounded-xl font-bold text-[#5D7180] hover:bg-[#F4F0ED] disabled:opacity-50"
                >
                  Cambiar imagen
                </button>
              </div>
            </div>
          )}

          {/* Resultados de comparación */}
          {(ocrResult || geminiResult) && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Resultado OCR */}
                <div className={`border-2 rounded-2xl p-4 ${ocrResult?.success ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-[#4A4A4A]">🔵 OCR (Google Vision)</h4>
                    {ocrResult?.success ? (
                      <CheckCircle size={20} className="text-green-600" />
                    ) : (
                      <AlertCircle size={20} className="text-red-600" />
                    )}
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-[#5D7180]" />
                      <span className="text-[#5D7180]">Tiempo: <strong>{ocrResult?.processingTime || 0}ms</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign size={14} className="text-[#5D7180]" />
                      <span className="text-[#5D7180]">Costo: <strong>${ocrResult?.cost?.toFixed(4) || '0.0000'}</strong></span>
                    </div>
                    
                    {ocrResult?.error ? (
                      <div className="mt-3 p-2 bg-red-100 rounded text-red-800 text-xs">
                        {ocrResult.error}
                      </div>
                    ) : (
                      <>
                        <div className="mt-3">
                          <p className="font-bold text-[#4A4A4A] mb-1">Datos extraídos:</p>
                          <div className="bg-white rounded-lg p-2 max-h-32 overflow-y-auto">
                            {Object.keys(ocrResult?.extractedData || {}).length === 0 ? (
                              <p className="text-[#5D7180] text-xs">No se encontraron datos</p>
                            ) : (
                              Object.entries(ocrResult?.extractedData || {}).map(([key, value]) => (
                                <div key={key} className="text-xs py-1 border-b border-gray-100 last:border-0">
                                  <span className="font-bold text-[#95706B]">{key}:</span> <span className="text-[#4A4A4A]">{String(value)}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                        {ocrResult?.extractedText && (
                          <details className="mt-2">
                            <summary className="text-xs font-bold text-[#5D7180] cursor-pointer">Ver texto completo</summary>
                            <div className="mt-2 bg-white rounded p-2 max-h-24 overflow-y-auto text-[10px] text-[#4A4A4A]">
                              {ocrResult.extractedText.substring(0, 500)}...
                            </div>
                          </details>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Resultado Gemini Vision */}
                <div className={`border-2 rounded-2xl p-4 ${geminiResult?.success ? 'border-purple-200 bg-purple-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-[#4A4A4A]">🟣 Gemini Vision</h4>
                    {geminiResult?.success ? (
                      <CheckCircle size={20} className="text-green-600" />
                    ) : (
                      <AlertCircle size={20} className="text-red-600" />
                    )}
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-[#5D7180]" />
                      <span className="text-[#5D7180]">Tiempo: <strong>{geminiResult?.processingTime || 0}ms</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign size={14} className="text-[#5D7180]" />
                      <span className="text-[#5D7180]">Costo: <strong>${geminiResult?.cost?.toFixed(4) || '0.0000'}</strong></span>
                    </div>
                    
                    {geminiResult?.detectedType && geminiResult.detectedType !== 'unknown' && (
                      <div className="mt-2 p-2 bg-purple-100 rounded text-purple-800 text-xs">
                        <strong>Tipo detectado:</strong> {geminiResult.detectedType}
                      </div>
                    )}
                    
                    {geminiResult?.error ? (
                      <div className="mt-3 p-2 bg-red-100 rounded text-red-800 text-xs">
                        {geminiResult.error}
                      </div>
                    ) : (
                      <>
                        <div className="mt-3">
                          <p className="font-bold text-[#4A4A4A] mb-1">Datos extraídos:</p>
                          <div className="bg-white rounded-lg p-2 max-h-32 overflow-y-auto">
                            {Object.keys(geminiResult?.extractedData || {}).length === 0 ? (
                              <p className="text-[#5D7180] text-xs">No se encontraron datos</p>
                            ) : (
                              Object.entries(geminiResult?.extractedData || {}).map(([key, value]) => {
                                const val = value as any;
                                return (
                                  <div key={key} className="text-xs py-1 border-b border-gray-100 last:border-0">
                                    <span className="font-bold text-[#95706B]">{key}:</span>{' '}
                                    <span className="text-[#4A4A4A]">
                                      {val.value} {val.unit ? val.unit : ''} {val.normal ? `(normal: ${val.normal})` : ''}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                        {geminiResult?.extractedText && (
                          <details className="mt-2">
                            <summary className="text-xs font-bold text-[#5D7180] cursor-pointer">Ver texto sanitizado</summary>
                            <div className="mt-2 bg-white rounded p-2 max-h-24 overflow-y-auto text-[10px] text-[#4A4A4A]">
                              {geminiResult.extractedText.substring(0, 500)}...
                            </div>
                          </details>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Comparación resumida */}
              {ocrResult && geminiResult && (
                <div className="bg-[#F9F6F4] border border-[#F4F0ED] rounded-2xl p-4">
                  <h4 className="font-bold text-[#4A4A4A] mb-3 text-sm">📊 Comparación</h4>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-[#5D7180] mb-1">Velocidad</p>
                      <p className="font-bold text-[#4A4A4A]">
                        {ocrResult.processingTime < geminiResult.processingTime ? '🔵 OCR más rápido' : '🟣 Gemini más rápido'}
                      </p>
                      <p className="text-[#5D7180] text-[10px] mt-1">
                        OCR: {ocrResult.processingTime}ms | Gemini: {geminiResult.processingTime}ms
                      </p>
                    </div>
                    <div>
                      <p className="text-[#5D7180] mb-1">Datos extraídos</p>
                      <p className="font-bold text-[#4A4A4A]">
                        OCR: {Object.keys(ocrResult.extractedData || {}).length} campos
                      </p>
                      <p className="font-bold text-[#4A4A4A]">
                        Gemini: {Object.keys(geminiResult.extractedData || {}).length} campos
                      </p>
                    </div>
                    <div>
                      <p className="text-[#5D7180] mb-1">Costo diferencia</p>
                      <p className="font-bold text-[#4A4A4A]">
                        {((geminiResult.cost || 0) - (ocrResult.cost || 0)).toFixed(4)} USD
                      </p>
                      <p className="text-[#5D7180] text-[10px] mt-1">
                        {((geminiResult.cost || 0) / (ocrResult.cost || 0.001)).toFixed(1)}x más caro
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex-1 bg-[#5D7180] text-white py-3 rounded-xl font-bold"
                >
                  Probar otra imagen
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 border border-[#E1D7D3] rounded-xl font-bold text-[#5D7180] hover:bg-[#F4F0ED]"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

