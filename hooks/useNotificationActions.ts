import { useCallback } from 'react';
import { AppNotification, NotificationAction } from '../types';
import { formatDateForDB } from '../services/dataService';
import { handlePeriodConfirmed, handlePeriodDelayed } from '../services/RuleEngine';
import { isValidNotificationHandler } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useAuth } from './useAuth';
import { logger } from '../lib/logger';

export function useNotificationActions() {
  const { user, markNotificationRead, fetchNotifications, showNotif } = useAppStore();
  const { refreshUserProfile } = useAuth();

  const handleNotificationAction = useCallback(async (
    notification: AppNotification,
    action: NotificationAction
  ) => {
    if (!user?.id) return;

    // Validate handler type safety
    if (!isValidNotificationHandler(action.handler)) {
      logger.warn('Invalid notification handler:', action.handler);
      showNotif('Acción no válida. Por favor, intenta nuevamente.', 'error');
      return;
    }

    try {
      if (action.handler === 'handlePeriodConfirmed') {
        const today = formatDateForDB(new Date());
        await handlePeriodConfirmed(user.id, today);
        await refreshUserProfile(user.id);
        showNotif('¡Gracias! Actualizamos tu ciclo.', 'success');
      } else if (action.handler === 'handlePeriodDelayed') {
        const parsedDays = typeof action.value === 'number' 
          ? action.value 
          : Number(action.value);
        const daysToAdd = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 2;
        await handlePeriodDelayed(user.id, daysToAdd);
        await refreshUserProfile(user.id);
        const currentUser = useAppStore.getState().user;
        if (currentUser) {
          showNotif(`Entendido. Ajustamos tu ciclo a ${currentUser.cycleLength} días.`, 'success');
        }
      } else if (action.handler === 'handleOvulationDetected') {
        logger.log('Ovulation detected handler called');
        showNotif('Ovulación detectada. ¡Excelente momento para intentar!', 'success');
      } else {
        logger.warn('Unhandled notification action:', action.handler);
        return;
      }

      await markNotificationRead(notification.id);
      await fetchNotifications(user.id);
    } catch (error) {
      logger.error('Error handling notification action', error);
      showNotif('No pudimos actualizar tu información. Intenta nuevamente.', 'error');
    }
  }, [user?.id, markNotificationRead, fetchNotifications, showNotif, refreshUserProfile]);

  return { handleNotificationAction };
}

