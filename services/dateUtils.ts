/**
 * Utilidades de fecha para trabajar SIEMPRE en horario local
 * y evitar problemas de timezone con strings YYYY-MM-DD.
 */

/**
 * Parsea una fecha en formato YYYY-MM-DD como fecha local (00:00:00).
 * Devuelve null si el string es inválido.
 */
export function parseLocalDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Igual que parseLocalDate pero devuelve siempre un Date (o hoy si es inválido).
 */
export function parseLocalDateOrToday(dateStr?: string | null): Date {
  const parsed = parseLocalDate(dateStr);
  return parsed ?? new Date();
}

/**
 * Formatea una fecha local a YYYY-MM-DD.
 */
export function formatToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calcula la edad actual desde una fecha de nacimiento
 * @param birthDate - Fecha de nacimiento en formato YYYY-MM-DD
 * @returns Edad en años o null si la fecha es inválida o está fuera del rango 18-55
 */
export function calculateAgeFromBirthdate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  
  const birth = parseLocalDate(birthDate);
  if (!birth) return null;
  
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  // Ajustar si aún no ha cumplido años este año
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  // Validación: edad razonable entre 18-55 años (rango fertilidad)
  if (age < 18 || age > 55) {
    return null;
  }
  
  return age;
}

