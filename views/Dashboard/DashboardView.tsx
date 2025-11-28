import { Activity, BookOpen, Plus } from 'lucide-react';
import { NotificationList } from '../../components/NotificationSystem';
import { MedicalReport } from '../../components/MedicalReport';
import LogHistoryItem from '../../components/common/LogHistoryItem';
import { generarDatosInformeMedico } from '../../services/MedicalReportHelpers';
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

  const handleQuickAccess = () => {
    const hasF0 = submittedForms.some(f => f.form_type === 'F0');
    if (!hasF0) {
      showNotif('Debes completar el F0 antes de registrar datos diarios', 'error');
      onNavigate('CONSULTATIONS');
    } else {
      onNavigate('TRACKER');
    }
  };

  const getScoreColor = (value: number) => {
    if (value < 40) return 'text-rose-500';
    if (value < 70) return 'text-amber-500';
    return 'text-emerald-500';
  };

  return (
    <div className="space-y-6 pb-24 pt-4">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#4A4A4A]">Hola, {user.name.split(' ')[0]}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${user.methodStartDate ? 'bg-[#C7958E] animate-pulse' : 'bg-stone-300'}`}></span>
            <p className="text-xs text-[#5D7180] font-medium uppercase tracking-wide">
              {user.methodStartDate ? `Día ${daysActive} del Método` : 'Método no iniciado'}
            </p>
          </div>
        </div>
        <button
          onClick={handleQuickAccess}
          className="bg-[#C7958E] text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg shadow-rose-200 hover:scale-105 transition-transform"
        >
          <Activity size={20} />
        </button>
      </header>

      <div className="space-y-6">
        {!user.methodStartDate && (
          <div className="bg-gradient-to-br from-[#C7958E] to-[#95706B] p-8 rounded-[2rem] shadow-xl text-white text-center relative overflow-hidden">
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
                className="bg-white text-[#C7958E] px-8 py-4 rounded-xl font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2 mx-auto"
              >
                <Activity size={20} />
                Iniciar Método
              </button>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#F4F0ED] relative overflow-hidden">
          <div className="flex flex-col items-center justify-center mb-8">
            <h3 className="font-bold text-[#4A4A4A] text-lg mb-2">Tu FertyScore</h3>
            <div className="bg-gradient-to-br from-[#C7958E] to-[#95706B] text-white w-24 h-24 rounded-full flex items-center justify-center font-bold text-4xl shadow-xl shadow-rose-200 border-4 border-white">
              {scores.total}
            </div>
            <p className="text-xs text-[#5D7180] mt-2">Puntuación Global</p>
          </div>

          <div className="flex justify-between items-center bg-[#F4F0ED]/50 p-4 rounded-2xl mb-6">
            {(['function', 'food', 'flora', 'flow'] as const).map(key => (
              <div className="text-center" key={key}>
                <span className={`block text-lg font-bold text-[#4A4A4A] ${getScoreColor(scores[key])}`}>{scores[key]}</span>
                <span className="text-[10px] text-[#95706B] font-bold uppercase">{key}</span>
              </div>
            ))}
          </div>

          <div className="bg-[#F9F6F4] p-4 rounded-xl border border-[#F4F0ED]">
            <div className="flex justify-between text-xs text-[#95706B] font-bold mb-2 uppercase tracking-wide">
              <span>Progreso del Método</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-[#F4F0ED]">
              <div className="h-full bg-[#9ECCB4] rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-[#5D7180] mt-1">
              <span>{daysActive}/90 días</span>
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
            <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Notificaciones Nuevas</h3>
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
            <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Último Registro</h3>
            <LogHistoryItem log={logs[0]} />
          </div>
        )}

        <div>
          <h3 className="font-bold text-[#4A4A4A] mb-3 text-sm">Acceso Rápido</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleQuickAccess}
              className="bg-white p-4 rounded-2xl shadow-sm border border-[#F4F0ED] flex items-center gap-4 hover:border-[#C7958E] transition-colors group text-left"
            >
              <div className="bg-[#C7958E]/10 p-3 rounded-full text-[#C7958E] group-hover:bg-[#C7958E] group-hover:text-white transition-colors">
                <Plus size={24} />
              </div>
              <div>
                <span className="block text-sm font-bold text-[#4A4A4A]">Registrar Diario</span>
                <span className="text-[10px] text-[#5D7180]">Añadir datos hoy</span>
              </div>
            </button>
            <button
              onClick={() => onNavigate('EDUCATION')}
              className="bg-white p-4 rounded-2xl shadow-sm border border-[#F4F0ED] flex items-center gap-4 hover:border-[#C7958E] transition-colors group text-left"
            >
              <div className="bg-[#95706B]/10 p-3 rounded-full text-[#95706B] group-hover:bg-[#95706B] group-hover:text-white transition-colors">
                <BookOpen size={24} />
              </div>
              <div>
                <span className="block text-sm font-bold text-[#4A4A4A]">Ver Módulos</span>
                <span className="text-[10px] text-[#5D7180]">Continuar curso</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;

