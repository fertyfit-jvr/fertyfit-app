import React from 'react';
import { AppNotification, NotificationAction, UserProfile, ViewState, isAINotification } from '../../types';
import { NotificationList } from '../../components/NotificationSystem';

interface ReportsViewProps {
  user: UserProfile;
  visibleNotifications: AppNotification[];
  showNotif: (msg: string, type: 'success' | 'error') => void;
  setView: (view: ViewState) => void;
  markNotificationRead: (id: number) => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  onNotificationAction: (notification: AppNotification, action: NotificationAction) => Promise<void>;
}

const ReportsView = ({
  user,
  visibleNotifications,
  showNotif,
  setView,
  markNotificationRead,
  deleteNotification,
  onNotificationAction
}: ReportsViewProps) => {
  // Filtrar solo informes de IA, excluyendo explicaciones de analíticas (type: 'LABS')
  const aiReports = visibleNotifications.filter(n => 
    isAINotification(n.type as string) && n.type !== 'LABS'
  );

  // Ordenar por fecha más reciente primero
  const sortedReports = [...aiReports].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div className="pb-24 pt-0">
      <div className="p-5 pt-0">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-ferty-dark mb-1">Informes</h2>
          <p className="text-[10px] text-ferty-gray">
            Tus informes generados por IA. Aquí encontrarás análisis, recomendaciones y explicaciones personalizadas.
          </p>
        </div>
        
        {/* Links discretos para navegar */}
        <div className="mb-4 flex justify-between items-center">
          <div className="flex gap-4">
            <button
              onClick={() => setView('CONSULTATIONS')}
              className="text-xs font-bold text-ferty-dark hover:text-ferty-gray transition-colors underline"
            >
              Crear informe →
            </button>
            <button
              onClick={() => setView('ANALYTICS')}
              className="text-xs text-ferty-gray hover:text-ferty-rose transition-colors underline"
            >
              Analíticas →
            </button>
          </div>
          <button
            onClick={() => setView('PROFILE')}
            className="text-xs text-ferty-gray hover:text-ferty-rose transition-colors underline"
          >
            Volver
          </button>
        </div>

        {sortedReports.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-dashed border-stone-200 text-center">
            <p className="text-stone-400 text-sm">Aún no tienes informes generados</p>
            <p className="text-stone-300 text-xs mt-2">Los informes se generan automáticamente cuando creas análisis, chats o explicaciones de analíticas</p>
          </div>
        ) : (
          <div className="space-y-4">
            <NotificationList
              notifications={sortedReports}
              onMarkRead={markNotificationRead}
              deleteNotification={deleteNotification}
              onAction={onNotificationAction}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsView;

