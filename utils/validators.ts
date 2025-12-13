// Validaciones reutilizables para NIT, NRC, teléfono y correo

export interface ValidationResult {
  valid: boolean;
  message: string;
}

export const validateNIT = (nit: string): ValidationResult => {
  if (!nit) return { valid: false, message: 'Requerido' };
  const nitClean = nit.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(nitClean)) return { valid: false, message: 'Solo números' };
  if (nitClean.length === 14) return { valid: true, message: 'NIT válido' };
  if (nitClean.length === 9) return { valid: true, message: 'DUI válido' };
  return { valid: false, message: `${nitClean.length} dígitos (9 ó 14)` };
};

export const validateNRC = (nrc: string): ValidationResult => {
  if (!nrc) return { valid: true, message: '' };
  const nrcClean = nrc.replace(/[\s-]/g, '');
  if (nrcClean.length === 0) return { valid: true, message: '' };
  if (!/^\d+$/.test(nrcClean)) return { valid: false, message: 'Solo números' };
  if (nrcClean.length < 6 || nrcClean.length > 8) return { valid: false, message: '6-8 dígitos' };
  return { valid: true, message: 'Válido' };
};

export const validatePhone = (phone: string): ValidationResult => {
  if (!phone) return { valid: false, message: 'Requerido' };
  const phoneClean = phone.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(phoneClean)) return { valid: false, message: 'Solo números' };
  if (phoneClean.length !== 8) return { valid: false, message: '8 dígitos' };
  return { valid: true, message: 'Válido' };
};

export const validateEmail = (email: string): ValidationResult => {
  if (!email) return { valid: false, message: 'Requerido' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) return { valid: false, message: 'Formato inválido' };
  return { valid: true, message: 'Válido' };
};
