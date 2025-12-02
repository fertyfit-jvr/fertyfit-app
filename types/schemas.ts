import { z } from 'zod';
import { DailyLog as DailyLogType } from '../types';

// Schema de validación para DailyLog antes de guardar en BD
// Sólo fecha y día de ciclo son estrictamente obligatorios; el resto puede ir
// completándose a lo largo del día.
export const DailyLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  cycleDay: z.number().int().min(1).max(100),

  bbt: z.number().min(35).max(39).nullable().optional(),
  mucus: z.string().optional(), // MucusType | ''
  cervixHeight: z.string().optional().nullable(),
  cervixFirmness: z.string().optional().nullable(),
  cervixOpenness: z.string().optional().nullable(),
  lhTest: z.string().optional(), // LHResult
  symptoms: z.array(z.string()).optional().default([]),
  sex: z.boolean().optional().default(false),

  sleepQuality: z.number().int().min(1).max(5).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  stressLevel: z.number().int().min(1).max(5).optional(),
  activityMinutes: z.number().min(0).optional(),
  sunMinutes: z.number().min(0).optional(),
  waterGlasses: z.number().int().min(0).optional(),
  veggieServings: z.number().int().min(0).optional(),
  alcohol: z.boolean().optional(),
  alcoholUnits: z.number().optional().nullable(),

  // Campos opcionales adicionales (wearable)
  dataSource: z.enum(['manual', 'wearable', 'hybrid']).optional(),
  sleepPhases: z
    .object({
      deep: z.number(),
      rem: z.number(),
      light: z.number()
    })
    .optional(),
  heartRateVariability: z.number().optional(),
  restingHeartRate: z.number().optional(),
  steps: z.number().optional(),
  activeCalories: z.number().optional(),
  oxygenSaturation: z.number().optional()
});

// Tipo validado basado en el schema
export type DailyLogValidated = z.infer<typeof DailyLogSchema> & Partial<Pick<DailyLogType, 'id' | 'user_id'>>;


