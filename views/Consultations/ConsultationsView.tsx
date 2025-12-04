import { useState } from 'react';
import { AlertCircle, Camera, Loader2, FileText, X } from 'lucide-react';
import { UserProfile } from '../../types';
import { ExamScanner } from '../../components/forms/ExamScanner';
import { FertyFitChat } from '../../components/chat/FertyFitChat';

interface ConsultationsViewProps {
  user: UserProfile;
  logs: any[];
  submittedForms: any[];
  showNotif: (msg: string, type: 'success' | 'error') => void;
  fetchUserForms: (userId: string) => Promise<void>;
}

const ConsultationsView = ({ user, showNotif }: ConsultationsViewProps) => {
  const [globalScannerOpen, setGlobalScannerOpen] = useState(false);
  const [globalExamType, setGlobalExamType] = useState<
    'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio' | 'other'
  >('hormonal');
  const [globalExamName, setGlobalExamName] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const handleDataExtracted = (data: Record<string, any>) => {
    showNotif('Datos extraídos correctamente. Revisa y confirma los valores.', 'success');
  };

  const handleGenerateReport = async () => {
    if (!user?.id) return;
    setIsGeneratingReport(true);
    setReportError(null);
    setReportText(null);
    setReportModalOpen(true);

    try {
      const response = await fetch('/api/analysis/report-extended', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          errorData.error ||
          `Error al generar el informe (${response.status}). Por favor, intenta de nuevo más tarde.`;
        setReportError(message);
        return;
      }

      const data = await response.json();
      setReportText(data.report || 'No se pudo generar el informe.');
    } catch (err: any) {
      setReportError(
        err?.message ||
          'Error al conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo.'
      );
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="pb-24 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#4A4A4A]">Consultas</h2>
        <p className="text-sm text-[#5D7180]">Sube tus analíticas y ecografías para un análisis completo.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#5D7180] text-white text-xs font-bold shadow-sm hover:bg-[#4A5568] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGeneratingReport ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generando informe...
              </>
            ) : (
              <>
                <FileText size={14} />
                Generar informe 360º
              </>
            )}
          </button>
        </div>
      </div>

      {/* Chat FertyFit */}
      {user?.id && (
        <FertyFitChat userId={user.id} dailyLimit={5} />
      )}

      {/* Bloque global de subida de analíticas/ecografías */}
      <div className="bg-white border border-[#F4F0ED] rounded-3xl p-4 shadow-sm mb-6">
        <p className="text-sm font-bold text-[#4A4A4A] mb-3">Subir analítica / Eco</p>
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          <select
            value={globalExamType}
            onChange={e => {
              setGlobalExamType(e.target.value as any);
              if (e.target.value !== 'other') {
                setGlobalExamName('');
              }
            }}
            className="flex-1 border border-[#F4F0ED] rounded-2xl p-3 text-sm bg-white focus:border-[#C7958E] focus:ring-1 focus:ring-[#C7958E]"
          >
            <option value="hormonal">Panel hormonal</option>
            <option value="metabolic">Panel metabólico</option>
            <option value="vitamin_d">Vitamina D</option>
            <option value="espermio">Espermiograma</option>
            <option value="ecografia">Ecografía transvaginal + AFC</option>
            <option value="hsg">Histerosalpingografía</option>
            <option value="other">Otro (especificar)</option>
          </select>

          {globalExamType === 'other' && (
            <input
              type="text"
              value={globalExamName}
              onChange={e => setGlobalExamName(e.target.value)}
              placeholder="¿Qué examen estás subiendo?"
              className="flex-1 border border-[#F4F0ED] rounded-2xl p-3 text-sm bg-[#F9F6F4] focus:border-[#C7958E] focus:ring-1 focus:ring-[#C7958E]"
            />
          )}

          <button
            type="button"
            onClick={() => setGlobalScannerOpen(true)}
            className="px-6 py-3 rounded-2xl bg-[#C7958E] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#B5847D] transition-colors shadow-sm"
          >
            <Camera size={18} />
            Escanear examen
          </button>
        </div>
      </div>

      {/* Exam Scanner Modal - Global */}
      {globalScannerOpen && (
        <ExamScanner
          examType={
            globalExamType === 'other'
              ? undefined
              : (globalExamType as 'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio')
          }
          onDataExtracted={handleDataExtracted}
          onClose={() => {
            setGlobalScannerOpen(false);
            setGlobalExamName('');
          }}
          sectionTitle={globalExamType === 'other' ? globalExamName || 'Examen' : undefined}
          autoDetect={globalExamType === 'other'}
          examName={globalExamType === 'other' ? globalExamName : undefined}
        />
      )}

      {/* Modal de informe 360º */}
      {reportModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#F4F0ED]">
              <div>
                <h3 className="text-lg font-bold text-[#4A4A4A]">Informe 360º FertyFit</h3>
                <p className="text-xs text-[#5D7180] mt-1">
                  Análisis narrativo basado en tu perfil, pilares, registros diarios y exámenes.
                </p>
              </div>
              <button
                onClick={() => setReportModalOpen(false)}
                className="text-[#5D7180] hover:bg-[#F4F0ED] p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {isGeneratingReport && (
                <div className="flex items-center gap-3 text-sm text-[#5D7180]">
                  <Loader2 size={18} className="animate-spin" />
                  <span>Estamos generando tu informe. Esto puede tardar unos segundos…</span>
                </div>
              )}

              {reportError && !isGeneratingReport && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-red-800">Error al generar el informe</p>
                      <div className="text-xs text-red-700 mt-1 whitespace-pre-line">{reportError}</div>
                    </div>
                  </div>
                </div>
              )}

              {reportText && !isGeneratingReport && !reportError && (
                <div className="bg-[#F9F6F4] border border-[#F4F0ED] p-4 rounded-2xl">
                  <p className="text-sm text-[#4A4A4A] whitespace-pre-line leading-relaxed">
                    {reportText}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultationsView;
