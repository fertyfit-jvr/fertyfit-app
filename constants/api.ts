/**
 * API and External URLs Configuration
 * Centralized location for all external URLs and API endpoints
 */

// Supabase Storage URLs for assets
export const SUPABASE_STORAGE_URL = import.meta.env.VITE_SUPABASE_STORAGE_URL || 
  'https://zoanaxbpbklpbhtcqiwb.supabase.co/storage/v1/object/public/assets';

// Pillar icons
export const PILLAR_ICONS = {
  FUNCTION: `${SUPABASE_STORAGE_URL}/FUNCTION.png`,
  FOOD: `${SUPABASE_STORAGE_URL}/FOOD.png`,
  FLORA: `${SUPABASE_STORAGE_URL}/FLORA.png`,
  FLOW: `${SUPABASE_STORAGE_URL}/FLOW.png`,
};

// External URLs
export const EXTERNAL_URLS = {
  FERTYFIT_HOME: import.meta.env.VITE_FERTYFIT_HOME_URL || 'https://fertyfit.com',
  VERCEL_API: import.meta.env.VITE_VERCEL_URL || 'https://method.fertyfit.com',
};

