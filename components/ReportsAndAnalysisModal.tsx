import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Camera, Loader2, FileText, CheckCircle, X } from 'lucide-react';
import { UserProfile, ViewState } from '../types';
import { ExamScanner } from './forms/ExamScanner';
import { useAppStore } from '../store/useAppStore';

type ReportType = '360' | 'BASIC' | 'DAILY' | 'LABS';
type LabsScope = 'LAST' | 'ALL';

interface ReportsAndAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile;
    showNotif: (msg: string, type: 'success' | 'error') => void;
    setView: (view: ViewState) => void;
}

export const ReportsAndAnalysisModal = ({ isOpen, onClose, user, showNotif, setView }: ReportsAndAnalysisModalProps) => {
    const { fetchNotifications } = useAppStore();
    const [globalScannerOpen, setGlobalScannerOpen] = useState(false);
    const [selectedReportType, setSelectedReportType] = useState<ReportType>('360');
    const [labsScope, setLabsScope] = useState<LabsScope>('LAST');
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [reportGenerationStartTime, setReportGenerationStartTime] = useState<number | null>(null);
    const [reportReady, setReportReady] = useState(false);
    const [reportWarnings, setReportWarnings] = useState<string[]>([]);
    const [showWarningDialog, setShowWarningDialog] = useState(false);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const handleDataExtracted = (data: Record<string, any>) => {
        showNotif('Datos extraídos correctamente. Revisa y confirma los valores.', 'success');
    };

    // Polling para detectar cuando el informe esté listo
    useEffect(() => {
        if (!reportGenerationStartTime || !user?.id) {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            return;
        }

        const startTime = reportGenerationStartTime;
        const reportType = selectedReportType;

        pollingIntervalRef.current = setInterval(async () => {
            try {
                await fetchNotifications(user.id);
                const currentNotifications = useAppStore.getState().notifications;

                const newReports = currentNotifications.filter(n => {
                    if (n.type !== 'REPORT') return false;
                    const reportTime = new Date(n.created_at).getTime();
                    return reportTime > startTime;
                });

                if (newReports.length > 0) {
                    setReportReady(true);
                    setIsGeneratingReport(false);
                    setReportGenerationStartTime(null);

                    if (pollingIntervalRef.current) {
                        clearInterval(pollingIntervalRef.current);
                        pollingIntervalRef.current = null;
                    }

                    showNotif(
                        `¡Tu ${getReportTypeLabel(reportType)} está listo! Puedes verlo en la pestaña "Informes".`,
                        'success'
                    );
                }
            } catch (error) {
                console.error('Error checking for report:', error);
            }
        }, 4000);

        const timeout = setTimeout(() => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            setIsGeneratingReport(false);
            setReportGenerationStartTime(null);
        }, 120000);

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
            clearTimeout(timeout);
        };
    }, [reportGenerationStartTime, user?.id, selectedReportType, fetchNotifications, showNotif]);

    // Verificar condiciones antes de generar (solo advertencias, no bloquea)
    const checkReportConditions = async (reportType: ReportType): Promise<boolean> => {
        try {
            const response = await fetch('/api/analysis/check-report-conditions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, reportType })
            });
            
            if (response.ok) {
                const { warnings } = await response.json();
                
                if (warnings && warnings.length > 0) {
                    setReportWarnings(warnings);
                    setShowWarningDialog(true);
                    return false; // No generar aún, esperar confirmación
                }
            }
            return true; // OK para generar
        } catch (error) {
            console.warn('Error checking conditions:', error);
            // Si falla la verificación, permitir generar igual
            return true;
        }
    };

    const handleGenerateReport = async (reportType: ReportType, skipCheck = false) => {
        if (!user?.id) return;

        // Si no se solicita skip, verificar condiciones primero
        if (!skipCheck) {
            const canProceed = await checkReportConditions(reportType);
            if (!canProceed) {
                return; // Esperar confirmación del usuario
            }
        }

        setIsGeneratingReport(true);
        setReportError(null);

        try {
            const response = await fetch('/api/analysis/report-extended', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    reportType,
                    manualTrigger: true, // Siempre true para botones manuales
                    ...(reportType === 'LABS' ? { labsScope } : {}),
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `Error al lanzar la generación del informe (${response.status})`;
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || errorMessage;
                } catch { }
                setReportError(errorMessage);
                return;
            }

            setReportGenerationStartTime(Date.now());
            setReportReady(false);

            showNotif(
                'Estamos generando tu informe. Te avisaremos cuando esté listo.',
                'success'
            );

            if (user.id) {
                await fetchNotifications(user.id);
            }
        } catch (err: any) {
            setReportError(
                err?.message ||
                'Error al conectar con el servidor. Verifica tu conexión a internet e intenta de nuevo.'
            );
            setIsGeneratingReport(false);
            setReportGenerationStartTime(null);
        }
    };

    const getReportTypeLabel = (type: ReportType): string => {
        switch (type) {
            case '360': return 'Informe 360º';
            case 'BASIC': return 'Informe Básico';
            case 'DAILY': return 'Informe Diario';
            case 'LABS': return 'Informe de Analíticas';
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative shadow-2xl">

                {/* Header */}
                <div className="sticky top-0 bg-white z-10 p-5 border-b border-ferty-beige flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold text-ferty-dark">Informes y Analíticas</h3>
                        <p className="text-xs text-ferty-gray">Genera informes o sube nuevos exámenes</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-ferty-beige/50 transition-colors text-ferty-gray"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Sección de generación de informes */}
                    <div className="bg-white border border-ferty-beige rounded-3xl p-6 shadow-sm">
                        <h4 className="text-lg font-bold text-ferty-dark mb-4">Generar Informe</h4>

                        {/* Selección de tipo de informe */}
                        <div className="space-y-4 mb-6">
                            {/* Informe 360º en columna completa */}
                            <button
                                onClick={() => setSelectedReportType('360')}
                                disabled={isGeneratingReport}
                                className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${selectedReportType === '360'
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    onClick={() => setSelectedReportType('BASIC')}
                                    disabled={isGeneratingReport}
                                    className={`p-4 rounded-2xl border-2 transition-all text-left ${selectedReportType === 'BASIC'
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
                                    className={`p-4 rounded-2xl border-2 transition-all text-left ${selectedReportType === 'DAILY'
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
                                    className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${selectedReportType === 'LABS'
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
                                            className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border ${labsScope === 'LAST'
                                                    ? 'border-ferty-rose bg-ferty-rose text-white'
                                                    : 'border-ferty-beige text-ferty-dark bg-white'
                                                }`}
                                        >
                                            Última analítica
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLabsScope('ALL')}
                                            className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border ${labsScope === 'ALL'
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
                            ) : reportReady ? (
                                <>
                                    <CheckCircle size={18} />
                                    Ver informe
                                </>
                            ) : (
                                <>
                                    <FileText size={18} />
                                    Generar {getReportTypeLabel(selectedReportType)}
                                </>
                            )}
                        </button>

                        {/* Mensaje de informe listo */}
                        {reportReady && !isGeneratingReport && (
                            <div className="mt-4 bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <CheckCircle size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-emerald-800">¡Informe generado exitosamente!</p>
                                        <p className="text-xs text-emerald-700 mt-1">
                                            Tu informe está listo. Puedes verlo en la pestaña "Informes".
                                        </p>
                                        <button
                                            onClick={() => {
                                                onClose();
                                                setView('REPORTS');
                                            }}
                                            className="mt-3 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors"
                                        >
                                            Ver informe ahora
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* Diálogo de advertencias */}
                        {showWarningDialog && reportWarnings.length > 0 && (
                            <div className="mt-4 bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-yellow-800">Advertencias sobre este informe</p>
                                        <ul className="text-xs text-yellow-700 mt-2 space-y-1">
                                            {reportWarnings.map((warning, idx) => (
                                                <li key={idx}>{warning}</li>
                                            ))}
                                        </ul>
                                        <div className="mt-3 flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setShowWarningDialog(false);
                                                    handleGenerateReport(selectedReportType, true); // skipCheck = true
                                                }}
                                                className="px-4 py-2 bg-yellow-600 text-white text-xs font-bold rounded-xl hover:bg-yellow-700 transition-colors"
                                            >
                                                Continuar de todas formas
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowWarningDialog(false);
                                                    setReportWarnings([]);
                                                }}
                                                className="px-4 py-2 bg-white border border-yellow-300 text-yellow-800 text-xs font-bold rounded-xl hover:bg-yellow-50 transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
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
                    <div className="bg-white border border-ferty-beige rounded-3xl p-4 shadow-sm">
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
                </div>
            </div>

            {/* Exam Scanner Modal - Nested in this modal */}
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
