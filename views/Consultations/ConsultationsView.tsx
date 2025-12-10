import { useState } from 'react';
import { AlertCircle, Camera, Loader2, FileText, MessageCircle, Copy, Check } from 'lucide-react';
import { UserProfile, ViewState } from '../../types';
import { ExamScanner } from '../../components/forms/ExamScanner';

type ReportType = '360' | 'BASIC' | 'DAILY';

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
  const [globalExamType, setGlobalExamType] = useState<
    'hormonal' | 'metabolic' | 'vitamin_d' | 'ecografia' | 'hsg' | 'espermio' | 'other'
  >('hormonal');
  const [globalExamName, setGlobalExamName] = useState('');
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('360');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [progressStage, setProgressStage] = useState<string>('');
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const handleDataExtracted = (data: Record<string, any>) => {
    showNotif('Datos extraídos correctamente. Revisa y confirma los valores.', 'success');
  };

  const handleGenerateReport = async (reportType: ReportType) => {
    if (!user?.id) return;

    setIsGeneratingReport(true);
    setReportError(null);
    setReportText(null);
    setProgressStage('INITIALIZING');
    setProgressMessage('Iniciando generación del informe...');

    try {
      const response = await fetch('/api/analysis/report-extended', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, reportType }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Error al generar el informe (${response.status})`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Si no es JSON, usar el texto tal cual
        }
        setReportError(errorMessage);
        setIsGeneratingReport(false);
        return;
      }

      // Leer el stream NDJSON
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No se pudo leer la respuesta del servidor');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Mantener la línea incompleta en el buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const event: ProgressEvent = JSON.parse(line);
              
              setProgressStage(event.stage);
              setProgressMessage(event.message);

              if (event.stage === 'COMPLETE') {
                setReportText(event.data?.report || 'No se pudo generar el informe.');
                setIsGeneratingReport(false);
              } else if (event.stage === 'ERROR') {
                setReportError(event.data?.error || 'Error desconocido al generar el informe');
                setIsGeneratingReport(false);
              }
            } catch (parseError) {
              // Ignorar líneas que no son JSON válido
            }
          }
        }
      }

      // Procesar cualquier línea restante en el buffer
      if (buffer.trim()) {
        try {
          const event: ProgressEvent = JSON.parse(buffer);
          setProgressStage(event.stage);
          setProgressMessage(event.message);
          if (event.stage === 'COMPLETE') {
            setReportText(event.data?.report || 'No se pudo generar el informe.');
            setIsGeneratingReport(false);
          }
        } catch {
          // Ignorar si no es JSON válido
        }
      }
    } catch (err: any) {
      setReportError(
        err?.message ||
          'Error al conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo.'
      );
      setIsGeneratingReport(false);
    }
  };

  const handleCopyReport = async () => {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      showNotif('Informe copiado al portapapeles', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showNotif('Error al copiar el informe', 'error');
    }
  };

  const getProgressPercentage = (stage: string): number => {
    const stageMap: Record<string, number> = {
      INITIALIZING: 5,
      COLLECTING_PROFILE: 15,
      COLLECTING_LOGS: 30,
      COLLECTING_FORMS: 45,
      COLLECTING_PREVIOUS_REPORTS: 55,
      SEARCHING_KNOWLEDGE: 70,
      ANALYZING_DATA: 80,
      GENERATING: 90,
      COMPLETE: 100,
      ERROR: 0,
    };
    return stageMap[stage] || 0;
  };

  const getReportTypeLabel = (type: ReportType): string => {
    switch (type) {
      case '360':
        return 'Informe 360º';
      case 'BASIC':
        return 'Informe Básico';
      case 'DAILY':
        return 'Informe Diario';
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

        {/* Área de progreso */}
        {isGeneratingReport && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 size={20} className="animate-spin text-ferty-rose" />
              <div className="flex-1">
                <p className="text-sm font-bold text-ferty-dark">
                  {progressMessage || 'Procesando...'}
                </p>
                <div className="mt-2 w-full bg-ferty-beige rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-ferty-rose h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${getProgressPercentage(progressStage)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Área de resultado */}
        {reportText && !isGeneratingReport && !reportError && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-ferty-dark">{getReportTypeLabel(selectedReportType)}</h4>
              <button
                onClick={handleCopyReport}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-ferty-beigeLight hover:bg-ferty-beige text-sm text-ferty-dark transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copiar
                  </>
                )}
              </button>
            </div>
            <div className="bg-ferty-beigeLight border border-ferty-beige p-4 rounded-2xl">
              <p className="text-sm text-ferty-dark whitespace-pre-line leading-relaxed">
                {reportText}
              </p>
            </div>
          </div>
        )}

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
        <p className="text-sm font-bold text-ferty-dark mb-3">Subir analítica / Eco</p>
        <div className="flex flex-col md:flex-row gap-3 items-stretch">
          <select
            value={globalExamType}
            onChange={e => {
              setGlobalExamType(e.target.value as any);
              if (e.target.value !== 'other') {
                setGlobalExamName('');
              }
            }}
            className="flex-1 border border-ferty-beige rounded-2xl p-3 text-sm bg-white focus:border-ferty-rose focus:ring-1 focus:ring-ferty-rose"
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
              className="flex-1 border border-ferty-beige rounded-2xl p-3 text-sm bg-ferty-beigeLight focus:border-ferty-rose focus:ring-1 focus:ring-ferty-rose"
            />
          )}

          <button
            type="button"
            onClick={() => setGlobalScannerOpen(true)}
            className="px-6 py-3 rounded-2xl bg-ferty-rose text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-ferty-roseHover transition-colors shadow-sm"
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
    </div>
  );
};

export default ConsultationsView;
