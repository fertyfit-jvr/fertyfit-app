/**
 * Custom hook for authentication and user profile management
 * Centralizes auth logic and profile creation/checking
 */

import { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../services/supabase';
import { fetchProfileForUser } from '../services/userDataService';
import { logger } from '../lib/logger';
import { useAppStore } from '../store/useAppStore';

export function useAuth() {
  const { setUser, setView, setLoading, setAuthError } = useAppStore();
  const [authLoading, setAuthLoading] = useState(true);

  /**
   * Checks user session and loads profile
   * Creates profile if it doesn't exist
   */
  const checkUser = async () => {
    setLoading(true);
    setAuthLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (session?.user) {
        let profile = await fetchProfileForUser(session.user.id);

        // If profile doesn't exist, create it
        if (!profile) {
          const metaName = session.user.user_metadata?.full_name;
          const emailName = session.user.email?.split('@')[0] || 'Usuario';
          const displayName = metaName || (emailName.charAt(0).toUpperCase() + emailName.slice(1));

          const { error: createError } = await supabase.from('profiles').insert({
            id: session.user.id,
            email: session.user.email,
            name: displayName,
            age: 30,
            disclaimer_accepted: false
          });

          if (createError) {
            logger.error("Profile creation failed:", createError);
            setLoading(false);
            setAuthLoading(false);
            return;
          }

          // Recursively call checkUser to load the newly created profile
          return checkUser();
        }

        if (profile) {
          // Map profile to UserProfile type
          const userProfile: UserProfile = {
            id: session.user.id,
            email: session.user.email || '',
            joinedAt: profile.created_at,
            methodStartDate: profile.method_start_date,
            name: profile.name,
            age: profile.age,
            weight: profile.weight,
            height: profile.height,
            timeTrying: typeof profile.time_trying === 'number' 
              ? profile.time_trying 
              : (typeof profile.time_trying === 'string' 
                  ? parseInt(profile.time_trying) || 0 
                  : 0),
            diagnoses: profile.diagnoses || [],
            treatments: [],
            disclaimerAccepted: profile.disclaimer_accepted,
            isOnboarded: true,
            mainObjective: profile.main_objective,
            partnerStatus: profile.partner_status,
            role: profile.role || 'user',
            cycleRegularity: profile.cycle_regularity,
            cycleLength: profile.cycle_length,
            lastPeriodDate: profile.last_period_date,
            periodHistory: profile.period_history || [],
            fertilityTreatments: profile.fertility_treatments,
            supplements: profile.supplements,
            alcoholConsumption: profile.alcohol_consumption
          };

          setUser(userProfile);

          // Determine phase based on method start date
          let phase = 0;
          if (profile.method_start_date) {
            const start = new Date(profile.method_start_date);
            start.setHours(0, 0, 0, 0);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const days = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const week = Math.ceil(days / 7) || 1;
            if (week >= 1 && week <= 4) phase = 1;
            else if (week >= 5 && week <= 8) phase = 2;
            else if (week >= 9) phase = 3;
          }
          useAppStore.getState().setCurrentPhase(phase);

          // Show Phase Modal only once per phase
          const seenKey = `fertyfit_phase_seen_${session.user.id}_${phase}`;
          if (!localStorage.getItem(seenKey)) {
            useAppStore.getState().setShowPhaseModal(true);
          }

          if (!profile.disclaimer_accepted) {
            setView('DISCLAIMER');
          } else {
            setView('DASHBOARD');
          }
        }
      } else {
        setView('ONBOARDING');
      }
    } catch (err) {
      logger.error('❌ Error in checkUser:', err);
      setAuthError('Error al cargar perfil: ' + (err as any).message);
      setView('ONBOARDING');
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  };

  /**
   * Handles authentication (sign in / sign up)
   */
  const handleAuth = async (email: string, password: string, name: string, isSignUp: boolean) => {
    setAuthError('');
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } }
        });
        if (error) {
          setAuthError(error.message);
          return false;
        }
        return true; // Success, user should check email
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            setAuthError("Usuario no registrado o contraseña incorrecta.");
          } else {
            setAuthError(error.message);
          }
          return false;
        }
        await checkUser();
        return true;
      }
    } catch (e: any) {
      setAuthError(e.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles logout
   */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    useAppStore.getState().setLogs([]);
    setView('ONBOARDING');
  };

  /**
   * Refreshes user profile from database
   * Solo actualiza campos dinámicos del ciclo menstrual
   * PRESERVA todos los demás campos estáticos (methodStartDate, name, email, etc.)
   */
  const refreshUserProfile = async (userId: string) => {
    try {
      const profile = await fetchProfileForUser(userId);
      if (profile) {
        setUser(prevUser => {
          if (!prevUser) return prevUser;
          // Solo actualizar campos dinámicos del ciclo menstrual
          // methodStartDate y otros campos estáticos se preservan automáticamente del prevUser
          return {
            ...prevUser,
            lastPeriodDate: profile.last_period_date,
            cycleLength: profile.cycle_length,
            cycleRegularity: profile.cycle_regularity,
            periodHistory: profile.period_history || [],
          };
        });
      }
    } catch (error) {
      logger.error('Error in refreshUserProfile:', error);
    }
  };

  // Note: checkUser should be called explicitly from App.tsx, not automatically here

  return {
    checkUser,
    handleAuth,
    handleLogout,
    refreshUserProfile,
    authLoading
  };
}

