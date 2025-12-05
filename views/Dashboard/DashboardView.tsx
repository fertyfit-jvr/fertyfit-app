import { Activity, BookOpen, Plus } from 'lucide-react';
import { NotificationList } from '../../components/NotificationSystem';
import { MedicalReport } from '../../components/MedicalReport';
import LogHistoryItem from '../../components/common/LogHistoryItem';
import FertyScoreCircular from '../../components/common/FertyScoreCircular';
import ProgressBar from '../../components/common/ProgressBar';
import { generarDatosInformeMedico } from '../../services/MedicalReportHelpers';
import { useMethodProgress } from '../../hooks/useMethodProgress';
import {
  AppNotification,
  ConsultationForm,
  DailyLog,
  NotificationAction,
  UserProfile,
  ViewState
} from '../../types';

interface DashboardScores {
  total: number;
  function: number;
  food: number;
  flora: number;
  flow: number;
}

interface DashboardViewProps {
  user: UserProfile;
  logs: DailyLog[];
  todayLog: Partial<DailyLog>;
  scores: DashboardScores;
  progressPercent: number;
  daysActive: number;
  unreadNotifications: AppNotification[];
  submittedForms: ConsultationForm[];
  onStartMethod: () => void;
  onNavigate: (view: ViewState) => void;
  showNotif: (msg: string, type: 'success' | 'error') => void;
  onMarkNotificationRead: (id: number) => void;
  onDeleteNotification: (id: number) => void;
  onNotificationAction: (notification: AppNotification, action: NotificationAction) => void;
}

const DashboardView = ({
  user,
  logs,
  todayLog,
  scores,
  progressPercent,
  daysActive,
  unreadNotifications,
  submittedForms,
  onStartMethod,
  onNavigate,
  showNotif,
  onMarkNotificationRead,
  onDeleteNotification,
  onNotificationAction
}: DashboardViewProps) => {
  const medicalData = generarDatosInformeMedico(user, logs, todayLog.cycleDay);

  // Calcular día y semana usando hook compartido (consistente con ProfileView)
  const { displayDay, displayWeek, isStarted, isCompleted } = useMethodProgress(user.methodStartDate);

  const handleQuickAccess = () => {
    onNavigate('TRACKER');
  };


  return (
    <div className="space-y-6 pb-24 pt-4">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ferty-dark">Hola, {user.name.split(' ')[0]}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${user.methodStartDate ? 'bg-ferty-rose animate-pulse' : 'bg-stone-300'}`}></span>
            <div className="flex flex-col gap-0.5">
              {isStarted ? (
                <>
                  <p className="text-xs text-ferty-gray font-medium uppercase tracking-wide">
                    Día: {displayDay} - Semana: {displayWeek}
                  </p>
                  {isCompleted && (
                    <p className="text-[10px] text-emerald-600 font-semibold">
                      Método Finalizado
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-ferty-gray font-medium uppercase tracking-wide">
                  Método no iniciado
                </p>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleQuickAccess}
          className="bg-ferty-rose text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg shadow-rose-200 hover:scale-105 transition-transform"
        >
          <Activity size={20} />
        </button>
      </header>

      <div className="space-y-6">
        {!user.methodStartDate && (
          <div className="bg-gradient-to-br from-ferty-rose to-ferty-coral p-8 rounded-[2rem] shadow-xl text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
            <div className="relative z-10">
              <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <Activity size={32} className="text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-2">¡Comienza Tu Viaje!</h3>
              <p className="text-sm opacity-90 mb-6 leading-relaxed">
                Inicia el Método FertyFit y empieza a registrar tu progreso hacia la fertilidad óptima.
              </p>
              <button
                onClick={onStartMethod}
                className="bg-white text-ferty-rose px-8 py-4 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2 mx-auto"
              >
                <Activity size={20} />
                Iniciar Método
              </button>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-ferty-beige relative overflow-hidden">
          <FertyScoreCircular
            totalScore={scores.total}
            functionScore={scores.function}
            foodScore={scores.food}
            floraScore={scores.flora}
            flowScore={scores.flow}
            size={320}
          />

          <div className="mt-8 bg-ferty-beigeLight p-4 rounded-xl border border-ferty-beige">
            <ProgressBar 
              percentage={progressPercent}
              color="rose-gradient"
              height="md"
              showLabel
              label="Progreso del Método"
              showPercentage
              containerClassName="mb-2"
            />
            <div className="flex justify-between text-[10px] text-ferty-gray mt-1">
              <span>{displayDay}/90 días</span>
            </div>
          </div>
        </div>

        <MedicalReport
          data={medicalData}
          user={user}
          logs={logs}
          onCompleteProfile={() => onNavigate('CONSULTATIONS')}
        />

        {unreadNotifications.length > 0 && (
          <div>
            <h3 className="font-bold text-ferty-dark mb-3 text-sm">Notificaciones Nuevas</h3>
            <NotificationList
              notifications={unreadNotifications}
              onMarkRead={onMarkNotificationRead}
              deleteNotification={onDeleteNotification}
              onAction={onNotificationAction}
            />
          </div>
        )}

        {logs.length > 0 && (
          <div>
            <h3 className="font-bold text-ferty-dark mb-3 text-sm">Último Registro</h3>
            <LogHistoryItem log={logs[0]} />
          </div>
        )}

        <div>
          <h3 className="font-bold text-ferty-dark mb-3 text-sm">Acceso Rápido</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleQuickAccess}
              className="bg-white p-4 rounded-2xl shadow-sm border border-ferty-beige flex items-center gap-4 hover:border-ferty-rose transition-colors group text-left"
            >
              <div className="bg-ferty-rose/10 p-3 rounded-full text-ferty-rose group-hover:bg-ferty-rose group-hover:text-white transition-colors">
                <Plus size={24} />
              </div>
              <div>
                <span className="block text-sm font-bold text-ferty-dark">Registrar Diario</span>
                <span className="text-[10px] text-ferty-gray">Añadir datos hoy</span>
              </div>
            </button>
            <button
              onClick={() => onNavigate('EDUCATION')}
              className="bg-white p-4 rounded-2xl shadow-sm border border-ferty-beige flex items-center gap-4 hover:border-ferty-rose transition-colors group text-left"
            >
              <div className="bg-ferty-coral/10 p-3 rounded-full text-ferty-coral group-hover:bg-ferty-coral group-hover:text-white transition-colors">
                <BookOpen size={24} />
              </div>
              <div>
                <span className="block text-sm font-bold text-ferty-dark">Ver Módulos</span>
                <span className="text-[10px] text-ferty-gray">Continuar curso</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;

