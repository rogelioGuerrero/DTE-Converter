export type MHMode = 'mock' | 'sandbox' | 'prod';

export const getMHMode = (): MHMode => {
  const raw = (import.meta as any)?.env?.VITE_MH_MODE;
  if (raw === 'sandbox' || raw === 'prod' || raw === 'mock') return raw;
  return 'mock';
};
