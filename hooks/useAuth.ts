/**
 * Custom hook for authentication and user profile management
 * Centralizes auth logic and profile creation/checking
 */

import { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../services/supabase';
import { fetchProfileForUser, createProfileForUser } from '../services/userDataService';
import { logger } from '../lib/logger';
import { useAppStore } from '../store/useAppStore';
import { calculateCurrentMonthsTrying } from '../services/timeTryingService';

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

          const profileResult = await createProfileForUser({
            id: session.user.id,
            email: session.user.email,
            name: displayName
          });

          if (!profileResult.success) {
            logger.error('Profile creation failed:', profileResult.error);
            setLoading(false);
            setAuthLoading(false);
            return;
          }

          // Recursively call checkUser to load the newly created profile
          return checkUser();
        }

        if (profile) {
          // Calculate timeTrying dynamically
          const calculatedTimeTrying = profile.time_trying_start_date
            ? calculateCurrentMonthsTrying(profile.time_trying_start_date, profile.time_trying_initial_months || null)
            : null;

          // Map profile to UserProfile type
          const userProfile: UserProfile = {
            id: session.user.id,
            email: session.user.email || '',
            joinedAt: profile.created_at,
            methodStartDate: profile.method_start_date,
            name: profile.name,
            age: profile.age,
            birthDate: profile.birth_date || undefined,
            weight: profile.weight,
            height: profile.height,
            timeTrying: calculatedTimeTrying ?? undefined,
            timeTryingStartDate: profile.time_trying_start_date || undefined,
            timeTryingInitialMonths: profile.time_trying_initial_months || undefined,
            treatments: [],
            isOnboarded: true,
            mainObjective: profile.main_objective,
            partnerStatus: profile.partner_status,
            familyHistory: profile.family_history,
            surgicalHistory: profile.surgical_history,
            obstetricHistory: profile.obstetric_history,
            fertilityTreatments: profile.fertility_treatments,
            diagnoses: profile.diagnoses, // TEXT field from F0
            role: (profile.role as 'user') || 'user',
            cycleRegularity: (profile.cycle_regularity as 'Regular' | 'Irregular') || undefined,
            cycleLength: profile.cycle_length,
            lastPeriodDate: profile.last_period_date,
            periodHistory: profile.period_history || [],
            // Consent fields
            consent_personal_data: profile.consent_personal_data,
            consent_food: profile.consent_food,
            consent_flora: profile.consent_flora,
            consent_flow: profile.consent_flow,
            consent_function: profile.consent_function,
            consent_daily_log: profile.consent_daily_log,
            consent_no_diagnosis: profile.consent_no_diagnosis,
            consents_at: profile.consents_at,
          };

          setUser(userProfile);

          // Always redirect to DASHBOARD, consent flow is handled automatically in App.tsx
          setView('DASHBOARD');
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
   * Updates only dynamic cycle fields, preserves static fields
   */
  const refreshUserProfile = async (userId: string) => {
    const currentUser = useAppStore.getState().user;
    if (!currentUser?.id || currentUser.id !== userId) {
      logger.warn('refreshUserProfile: No user in store or ID mismatch, skipping');
      return;
    }

    try {
      const profile = await fetchProfileForUser(userId);
      if (profile) {
        // Fix: setUser does not support functional updates. Merge manually.
        // Also casting types
        const updatedUser: UserProfile = {
          ...currentUser,
          lastPeriodDate: profile.last_period_date,
          cycleLength: profile.cycle_length,
          cycleRegularity: (profile.cycle_regularity as 'Regular' | 'Irregular') || undefined,
          periodHistory: profile.period_history || [],
        };
        setUser(updatedUser);
      }
    } catch (error) {
      logger.error('Error in refreshUserProfile:', error);
    }
  };

  return {
    checkUser,
    handleAuth,
    handleLogout,
    refreshUserProfile,
    authLoading
  };
}

