/**
 * Validation Schemas using Zod
 * Centralized validation for all user inputs
 */

import { z } from 'zod';

// ============================================================================
// AUTH SCHEMAS
// ============================================================================

export const LoginSchema = z.object({
  email: z.string()
    .email('Email inválido')
    .min(5, 'Email demasiado corto')
    .max(255, 'Email demasiado largo')
    .toLowerCase()
    .trim(),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'Contraseña demasiado larga'),
});

export const SignUpSchema = LoginSchema.extend({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'Nombre demasiado largo')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras')
    .trim(),
});

// ============================================================================
// PROFILE SCHEMAS
// ============================================================================

export const ProfileUpdateSchema = z.object({
  name: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'Nombre demasiado largo')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras')
    .trim()
    .optional(),
  weight: z.number()
    .min(30, 'Peso mínimo: 30kg')
    .max(200, 'Peso máximo: 200kg')
    .optional(),
  height: z.number()
    .min(100, 'Altura mínima: 100cm')
    .max(250, 'Altura máxima: 250cm')
    .optional(),
  age: z.number()
    .int('La edad debe ser un número entero')
    .min(18, 'Edad mínima: 18 años')
    .max(60, 'Edad máxima: 60 años')
    .optional(),
  lastPeriodDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .refine((date) => {
      const dateObj = new Date(date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return dateObj <= today;
    }, 'La fecha no puede ser futura')
    .optional(),
  cycleLength: z.number()
    .int('La duración del ciclo debe ser un número entero')
    .min(21, 'Ciclo mínimo: 21 días')
    .max(45, 'Ciclo máximo: 45 días')
    .optional(),
  cycleRegularity: z.enum(['regular', 'irregular']).optional(),
  mainObjective: z.string().max(500).optional(),
  timeTrying: z.union([
    z.number().int().min(0).max(240),
    z.string().max(50),
  ]).optional(),
  diagnoses: z.array(z.string()).optional(),
  partnerStatus: z.enum(['solo', 'pareja']).optional(),
  fertilityTreatment: z.enum(['si', 'no']).optional(),
  medicalHistory: z.string().max(2000).optional(),
  familyHistory: z.string().max(2000).optional(),
});

export const CycleUpdateSchema = z.object({
  lastPeriodDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .refine((date) => {
      const dateObj = new Date(date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return dateObj <= today;
    }, 'La fecha no puede ser futura'),
  cycleLength: z.number()
    .int('La duración del ciclo debe ser un número entero')
    .min(21, 'Ciclo mínimo: 21 días')
    .max(45, 'Ciclo máximo: 45 días')
    .optional(),
});

export const PeriodHistorySchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .refine((date) => {
      const dateObj = new Date(date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return dateObj <= today;
    }, 'La fecha no puede ser futura'),
  cycleLength: z.number()
    .int('La duración del ciclo debe ser un número entero')
    .min(21, 'Ciclo mínimo: 21 días')
    .max(45, 'Ciclo máximo: 45 días')
    .optional(),
});

// ============================================================================
// DAILY LOG SCHEMAS
// ============================================================================

export const DailyLogSchema = z.object({
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  cycleDay: z.number()
    .int()
    .min(1)
    .max(50)
    .optional(),
  bbt: z.number()
    .min(35.0, 'Temperatura mínima: 35.0°C')
    .max(40.0, 'Temperatura máxima: 40.0°C')
    .optional()
    .nullable(),
  mucus: z.enum(['Seco', 'Pegajoso', 'Cremoso', 'Clara de huevo', 'Acuoso', '']).optional(),
  cervixHeight: z.enum(['Bajo', 'Alto', '']).optional(),
  cervixFirmness: z.enum(['Duro', 'Blando', '']).optional(),
  cervixOpenness: z.enum(['Cerrado', 'Abierto', '']).optional(),
  lhTest: z.enum(['Positivo', 'Negativo', 'No realizado']).optional(),
  symptoms: z.array(z.string()).optional(),
  sex: z.boolean().optional(),
  sleepQuality: z.number().int().min(1).max(5).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  stressLevel: z.number().int().min(1).max(5).optional(),
  activityMinutes: z.number().int().min(0).max(1440).optional(),
  sunMinutes: z.number().int().min(0).max(1440).optional(),
  waterGlasses: z.number().int().min(0).max(20).optional(),
  veggieServings: z.number().int().min(0).max(20).optional(),
  alcohol: z.boolean().optional(),
});

// ============================================================================
// API REQUEST SCHEMAS
// ============================================================================


export const OCRRequestSchema = z.object({
  image: z.string()
    .min(100, 'Imagen inválida o demasiado pequeña')
    .regex(/^data:image\/(jpeg|jpg|png|webp);base64,/, 'Formato de imagen inválido'),
  examType: z.enum(['hormonal', 'metabolic', 'vitamin_d', 'ecografia', 'hsg', 'espermio']),
});


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sanitiza un string removiendo caracteres peligrosos
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Sanitiza un número asegurándose de que sea válido
 */
export function sanitizeNumber(input: unknown): number | null {
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input)) return null;
    return input;
  }
  if (typeof input === 'string') {
    const parsed = parseFloat(input);
    if (isNaN(parsed) || !isFinite(parsed)) return null;
    return parsed;
  }
  return null;
}

/**
 * Valida y sanitiza un email
 */
export function sanitizeEmail(email: string): string | null {
  try {
    const parsed = LoginSchema.shape.email.parse(email);
    return parsed;
  } catch {
    return null;
  }
}
