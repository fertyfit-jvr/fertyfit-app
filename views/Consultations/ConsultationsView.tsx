import { useState } from 'react';
import { FileText } from 'lucide-react';
import { UserProfile, ViewState } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { FertyFitChat } from '../../components/chat/FertyFitChat';
import { ReportsAndAnalysisModal } from '../../components/ReportsAndAnalysisModal';

interface ConsultationsViewProps {
  user: UserProfile;
  logs: any[];
  submittedForms: any[];
  showNotif: (msg: string, type: 'success' | 'error') => void;
  fetchUserForms: (userId: string) => Promise<void>;
  setView: (view: ViewState) => void;
}

const ConsultationsView = ({ user, showNotif, setView }: ConsultationsViewProps) => {
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);

  return (
    <div className="pb-24 pt-0 h-[calc(100vh-96px)] flex flex-col relative">
      <div className="px-5 pt-0 flex flex-col h-full">
        {/* Header compacto */}
        <div className="flex-shrink-0 py-3 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-ferty-dark mb-0.5">Consultas</h2>
            <p className="text-[10px] text-ferty-gray">
              Habla con tu asistente personal sobre tu fertilidad.
            </p>
          </div>

          {/* Botón flotante para Informes/Analíticas */}
          <button
            onClick={() => setIsReportsModalOpen(true)}
            className="w-10 h-10 rounded-full bg-ferty-rose text-white flex items-center justify-center shadow-lg shadow-rose-200 hover:scale-105 transition-transform flex-shrink-0"
            title="Ver Informes y Analíticas"
          >
            <FileText size={18} />
          </button>
        </div>

        {/* Chat FertyFit - ocupa el resto del espacio */}
        <div className="flex-1 overflow-hidden min-h-0">
          {user?.id && (
            <FertyFitChat userId={user.id} dailyLimit={5} />
          )}
        </div>
      </div>

      {/* Modal de Informes y Analíticas */}
      <ReportsAndAnalysisModal
        isOpen={isReportsModalOpen}
        onClose={() => setIsReportsModalOpen(false)}
        user={user}
        showNotif={showNotif}
        setView={setView}
      />
    </div>
  );
};

export default ConsultationsView;
