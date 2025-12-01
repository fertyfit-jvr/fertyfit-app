/**
 * Dashboard Score Service
 * Orquesta la carga de datos de pilares y el cálculo del FertyScore
 * para mantener App.tsx lo más ligero posible.
 */

import { UserProfile, DailyLog } from '../types';
import { fetchPillarData } from './pillarService';
import { PillarFunction, PillarFood, PillarFlora, PillarFlow } from '../types/pillars';
import { calculateFertyScore, FertyPillars } from './fertyscoreService';

export interface DashboardScores {
  total: number;
  function: number;
  food: number;
  flora: number;
  flow: number;
}

// Scores vacíos se mostrarán como "-" en la UI, pero internamente son 0
export const emptyDashboardScores: DashboardScores = {
  total: 0,
  function: 0,
  food: 0,
  flora: 0,
  flow: 0
};

/**
 * Calcula los scores del dashboard usando:
 * - Perfil de la usuaria
 * - Registros diarios
 * - Datos de todos los pilares (FUNCTION, FOOD, FLORA, FLOW)
 */
export async function getDashboardScores(
  user: UserProfile | null,
  logs: DailyLog[]
): Promise<DashboardScores> {
  if (!user?.id) {
    return emptyDashboardScores;
  }

  // Cargar los datos actuales de cada pilar en paralelo
  const [functionData, foodData, floraData, flowData] = await Promise.all([
    fetchPillarData<PillarFunction>(user.id, 'FUNCTION'),
    fetchPillarData<PillarFood>(user.id, 'FOOD'),
    fetchPillarData<PillarFlora>(user.id, 'FLORA'),
    fetchPillarData<PillarFlow>(user.id, 'FLOW')
  ]);

  const pillars: FertyPillars = {
    function: functionData,
    food: foodData,
    flora: floraData,
    flow: flowData
  };

  return calculateFertyScore(user, logs, pillars);
}


