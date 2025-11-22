const STORAGE_KEY = 'dte_daily_export_limit';

interface DailyUsage {
  date: string;
  count: number;
}

const getTodayString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const readUsage = (): DailyUsage | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DailyUsage;
  } catch {
    return null;
  }
};

const writeUsage = (usage: DailyUsage) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // ignore quota or other errors
  }
};

export const consumeExportSlot = (maxPerDay = 5): { allowed: boolean; remaining: number } => {
  const today = getTodayString();
  const current = readUsage();

  let usage: DailyUsage;
  if (!current || current.date !== today) {
    usage = { date: today, count: 0 };
  } else {
    usage = current;
  }

  if (usage.count >= maxPerDay) {
    return { allowed: false, remaining: 0 };
  }

  const newCount = usage.count + 1;
  writeUsage({ date: today, count: newCount });

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('dte-usage-updated'));
  }

  return { allowed: true, remaining: Math.max(0, maxPerDay - newCount) };
};

export const getUsageInfo = (maxPerDay = 5): { count: number; remaining: number; max: number } => {
  const today = getTodayString();
  const current = readUsage();

  if (!current || current.date !== today) {
    return { count: 0, remaining: maxPerDay, max: maxPerDay };
  }

  const remaining = Math.max(0, maxPerDay - current.count);
  return { count: current.count, remaining, max: maxPerDay };
};
