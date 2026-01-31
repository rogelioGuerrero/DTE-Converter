export interface AppSettings {
  apiKey: string;
  pin: string;
  myNit: string;
  myNrc: string;
  useAutoDetection: boolean; // Modo empresa: auto-detecta ventas/compras basado en NIT/NRC
  aiProvider?: string;
  aiModel?: string;
}

const SETTINGS_KEY = 'dte_app_settings';

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  pin: '1321', // Default PIN as requested
  myNit: '',
  myNrc: '',
  useAutoDetection: false, // Por defecto: modo contador (manual)
  aiProvider: 'gemini',
  aiModel: 'gemini-2.5-flash',
};

export const loadSettings = (): AppSettings => {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (saved) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.error('Error parsing settings', e);
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
};

export const saveSettings = (settings: AppSettings): void => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};
