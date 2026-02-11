import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { logger } from '../lib/logger';

export function useUserDataLoader() {
  const { user, view, fetchLogs, fetchUserForms, fetchNotifications, fetchEducation } = useAppStore();
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      if (!user?.id || dataLoaded) return;

      logger.log('🔄 Fetching user data...');

      try {
        // Load data in parallel for better performance
        await Promise.all([
          fetchLogs(user.id),
          fetchUserForms(user.id),
          fetchNotifications(user.id),
          fetchEducation(user.id, user.methodStartDate || undefined),
        ]);



        logger.log('✅ Data fetched successfully');
        setDataLoaded(true);
      } catch (error) {
        logger.error('❌ Error loading user data:', error);
      }
    };

    // Only load data if user is authenticated and view allows it
    if (user?.id && (view === 'DASHBOARD' || view === 'DISCLAIMER') && !dataLoaded) {
      loadUserData();
    }
  }, [user?.id, view, dataLoaded, fetchLogs, fetchUserForms, fetchNotifications, fetchEducation]);

  // Reset dataLoaded flag when user logs out
  useEffect(() => {
    if (!user) {
      setDataLoaded(false);
    }
  }, [user]);

  return { dataLoaded };
}

