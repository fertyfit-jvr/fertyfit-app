import { useState } from 'react';
import { AlertCircle, Camera, Loader2, FileText, MessageCircle } from 'lucide-react';
import { UserProfile, ViewState } from '../../types';
import { ExamScanner } from '../../components/forms/ExamScanner';

type ReportType = '360' | 'BASIC' | 'DAILY' | 'LABS';
type LabsScope = 'LAST' | 'ALL';

interface ConsultationsViewProps {
  user: UserProfile;
  logs: any[];
  submittedForms: any[];
  showNotif: (msg: string, type: 'success' | 'error') => void;
  fetchUserForms: (userId: string) => Promise<void>;
  setView: (view: ViewState) => void;
}

interface ProgressEvent {
  stage: string;
  message: string;
  data?: any;
  timestamp?: string;
}

const ConsultationsView = ({ user, showNotif, setView }: ConsultationsViewProps) => {
  const [globalScannerOpen, setGlobalScannerOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('360');
  const [labsScope, setLabsScope] = useState<LabsScope>('LAST');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const handleDataExtracted = (data: Record<string, any>) => {
    showNotif('Datos extraídos correctamente. Revisa y confirma los valores.', 'success');
  };

  const handleGenerateReport = async (reportType: ReportType) => {
    if (!user?.id) return;

    setIsGeneratingReport(true);
    setReportError(null);

    try {
      const response = await fetch('/api/analysis/report-extended', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          reportType,
          ...(reportType === 'LABS' ? { labsScope } : {}),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Error al lanzar la generación del informe (${response.status})`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Si no es JSON, usar el texto tal cual
        }
        setReportError(errorMessage);
        return;
      }

      // Avisar a la usuaria de que el informe se está generando en segundo plano
      showNotif(
        'Estamos generando tu informe en segundo plano. Puedes ir a otra sección; lo encontrarás en la pestaña "Informes" cuando esté listo.',
        'success'
      );
    } catch (err: any) {
      setReportError(
        err?.message ||
          'Error al conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo.'
      );
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const getReportTypeLabel = (type: ReportType): string => {
    switch (type) {
      case '360':
        return 'Informe 360º';
      case 'BASIC':
        return 'Informe Básico';
      case 'DAILY':
        return 'Informe Diario';
      case 'LABS':
        return 'Informe de Analíticas';
    }
  };

  return (
    <div className="pb-24 space-y-6">
      <div className="mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-ferty-dark mb-1">Consultas</h2>
            <p className="text-sm text-ferty-gray">Sube tus analíticas y ecografías para un análisis completo.</p>
          </div>
          <button
            onClick={() => setView('CHAT')}
            className="w-10 h-10 rounded-full bg-ferty-rose text-white flex items-center justify-center shadow-lg shadow-rose-200 hover:scale-105 transition-transform flex-shrink-0"
            title="Abrir chat"
          >
            <MessageCircle size={18} />
          </button>
        </div>
      </div>

      {/* Sección de generación de informes */}
      <div className="bg-white border border-ferty-beige rounded-3xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-ferty-dark mb-4">Generar Informe</h3>

        {/* Selección de tipo de informe */}
        <div className="space-y-4 mb-6">
          {/* Informe 360º en columna completa */}
          <button
            onClick={() => setSelectedReportType('360')}
            disabled={isGeneratingReport}
            className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
              selectedReportType === '360'
                ? 'border-ferty-rose bg-ferty-rose/10'
                : 'border-ferty-beige hover:border-ferty-gray'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="font-bold text-ferty-dark mb-1">Informe 360º</div>
            <div className="text-xs text-ferty-gray">
              Análisis completo con todos tus datos
            </div>
          </button>

          {/* Informe Básico e Informe Diario en dos columnas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setSelectedReportType('BASIC')}
              disabled={isGeneratingReport}
              className={`p-4 rounded-2xl border-2 transition-all text-left ${
                selectedReportType === 'BASIC'
                  ? 'border-ferty-rose bg-ferty-rose/10'
                  : 'border-ferty-beige hover:border-ferty-gray'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="font-bold text-ferty-dark mb-1">Informe Básico</div>
              <div className="text-xs text-ferty-gray">
                F0 y formularios de pilares
              </div>
            </button>

            <button
              onClick={() => setSelectedReportType('DAILY')}
              disabled={isGeneratingReport}
              className={`p-4 rounded-2xl border-2 transition-all text-left ${
                selectedReportType === 'DAILY'
                  ? 'border-ferty-rose bg-ferty-rose/10'
                  : 'border-ferty-beige hover:border-ferty-gray'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="font-bold text-ferty-dark mb-1">Informe Diario</div>
              <div className="text-xs text-ferty-gray">
                Análisis de registros diarios
              </div>
            </button>
          </div>

          {/* Informe de Analíticas */}
          <div className="space-y-3">
            <button
              onClick={() => setSelectedReportType('LABS')}
              disabled={isGeneratingReport}
              className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                selectedReportType === 'LABS'
                  ? 'border-ferty-rose bg-ferty-rose/10'
                  : 'border-ferty-beige hover:border-ferty-gray'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="font-bold text-ferty-dark mb-1">Informe de Analíticas</div>
              <div className="text-xs text-ferty-gray">
                Perfil + F0 + pilares + analíticas (última o todas)
              </div>
            </button>

            {selectedReportType === 'LABS' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setLabsScope('LAST')}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border ${
                    labsScope === 'LAST'
                      ? 'border-ferty-rose bg-ferty-rose text-white'
                      : 'border-ferty-beige text-ferty-dark bg-white'
                  }`}
                >
                  Última analítica
                </button>
                <button
                  type="button"
                  onClick={() => setLabsScope('ALL')}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border ${
                    labsScope === 'ALL'
                      ? 'border-ferty-rose bg-ferty-rose text-white'
                      : 'border-ferty-beige text-ferty-dark bg-white'
                  }`}
                >
                  Todas las analíticas
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Botón de generación */}
        <button
          onClick={() => handleGenerateReport(selectedReportType)}
          disabled={isGeneratingReport}
          className="w-full px-6 py-3 rounded-2xl bg-ferty-gray text-white font-bold flex items-center justify-center gap-2 hover:bg-ferty-grayHover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isGeneratingReport ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Generando informe...
            </>
          ) : (
            <>
              <FileText size={18} />
              Generar {getReportTypeLabel(selectedReportType)}
            </>
          )}
        </button>


        {/* Área de error */}
        {reportError && !isGeneratingReport && (
          <div className="mt-6 bg-red-50 border border-red-200 p-4 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">Error al generar el informe</p>
                <p className="text-xs text-red-700 mt-1 whitespace-pre-line">{reportError}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bloque global de subida de analíticas/ecografías */}
      <div className="bg-white border border-ferty-beige rounded-3xl p-4 shadow-sm mb-6">
        <p className="text-sm font-bold text-ferty-dark mb-3">Subir examen médico</p>
        <p className="text-xs text-ferty-gray mb-4">
          Puedes subir cualquier tipo de examen médico. Detectaremos automáticamente el tipo y extraeremos los datos.
        </p>
        <button
          type="button"
          onClick={() => setGlobalScannerOpen(true)}
          className="w-full px-6 py-3 rounded-2xl bg-ferty-rose text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-ferty-roseHover transition-colors shadow-sm"
        >
          <Camera size={18} />
          Escanear examen
        </button>
      </div>

      {/* Exam Scanner Modal - Global */}
      {globalScannerOpen && (
        <ExamScanner
          autoDetect={true}
          onDataExtracted={handleDataExtracted}
          onClose={() => {
            setGlobalScannerOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default ConsultationsView;
