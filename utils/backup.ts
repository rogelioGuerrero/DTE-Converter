export interface BackupPayloadV1 {
  backupVersion: 1;
  createdAt: string;
  app: {
    localStorage: Record<string, string>;
  };
  indexedDb: {
    clients?: any;
    history?: any;
    secure?: any;
  };
}

const LS_PREFIXES = ['dte_'];
const LS_ALLOWLIST = [
  'dte_app_settings',
  'dte_inventario_simplificado_v1',
  'dte_user_mode',
  'dte_setup_completed',
  'dte_onboarding_complete',
  'dte-license',
];

const shouldIncludeLocalStorageKey = (key: string): boolean => {
  if (!key) return false;
  if (LS_ALLOWLIST.includes(key)) return true;
  return LS_PREFIXES.some((p) => key.startsWith(p));
};

const downloadTextFile = (filename: string, content: string, contentType: string): void => {
  const blob = new Blob([content], { type: contentType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

const getAllLocalStorage = (): Record<string, string> => {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (!shouldIncludeLocalStorageKey(key)) continue;
      const value = localStorage.getItem(key);
      if (typeof value === 'string') out[key] = value;
    }
  } catch {
    // ignore
  }
  return out;
};

const openIdbDatabase = (name: string, version?: number): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

const idbGetAll = async (dbName: string, storeName: string): Promise<any[]> => {
  const db = await openIdbDatabase(dbName);
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const res = await new Promise<any[]>((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return res;
};

const idbClearAndBulkPut = async (dbName: string, storeName: string, items: any[], version?: number): Promise<void> => {
  const db = await openIdbDatabase(dbName, version);
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);

  await new Promise<void>((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  for (const it of items || []) {
    await new Promise<void>((resolve, reject) => {
      const req = store.put(it);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  db.close();
};

export const exportBackup = async (): Promise<BackupPayloadV1> => {
  const payload: BackupPayloadV1 = {
    backupVersion: 1,
    createdAt: new Date().toISOString(),
    app: {
      localStorage: getAllLocalStorage(),
    },
    indexedDb: {},
  };

  try {
    payload.indexedDb.clients = {
      dbName: 'dte-clients-db',
      version: 1,
      storeName: 'clients',
      items: await idbGetAll('dte-clients-db', 'clients'),
    };
  } catch {
    // ignore
  }

  try {
    payload.indexedDb.history = {
      dbName: 'dte-history-db',
      version: 1,
      storeName: 'dteHistory',
      items: await idbGetAll('dte-history-db', 'dteHistory'),
    };
  } catch {
    // ignore
  }

  try {
    payload.indexedDb.secure = {
      dbName: 'dte_secure_db',
      version: 2,
      storeName: 'credentials',
      items: await idbGetAll('dte_secure_db', 'credentials'),
    };
  } catch {
    // ignore
  }

  return payload;
};

export const downloadBackup = async (): Promise<void> => {
  const payload = await exportBackup();
  const content = JSON.stringify(payload, null, 2);
  const filename = `dte_backup_${new Date().toISOString().split('T')[0]}.json`;
  downloadTextFile(filename, content, 'application/json;charset=utf-8;');
};

export const restoreBackupFromText = async (jsonText: string): Promise<void> => {
  const parsed = JSON.parse(jsonText);
  if (!parsed || parsed.backupVersion !== 1) {
    throw new Error('Backup inválido o versión no soportada');
  }

  const payload = parsed as BackupPayloadV1;

  // LocalStorage: solo claves dte_ / allowlist
  try {
    const existingKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && shouldIncludeLocalStorageKey(k)) existingKeys.push(k);
    }
    for (const k of existingKeys) localStorage.removeItem(k);

    for (const [k, v] of Object.entries(payload.app?.localStorage || {})) {
      if (!shouldIncludeLocalStorageKey(k)) continue;
      if (typeof v === 'string') localStorage.setItem(k, v);
    }
  } catch {
    // ignore
  }

  // IndexedDB
  if (payload.indexedDb?.clients?.items) {
    await idbClearAndBulkPut(
      payload.indexedDb.clients.dbName || 'dte-clients-db',
      payload.indexedDb.clients.storeName || 'clients',
      payload.indexedDb.clients.items || [],
      payload.indexedDb.clients.version || 1
    );
  }

  if (payload.indexedDb?.history?.items) {
    await idbClearAndBulkPut(
      payload.indexedDb.history.dbName || 'dte-history-db',
      payload.indexedDb.history.storeName || 'dteHistory',
      payload.indexedDb.history.items || [],
      payload.indexedDb.history.version || 1
    );
  }

  if (payload.indexedDb?.secure?.items) {
    await idbClearAndBulkPut(
      payload.indexedDb.secure.dbName || 'dte_secure_db',
      payload.indexedDb.secure.storeName || 'credentials',
      payload.indexedDb.secure.items || [],
      payload.indexedDb.secure.version || 2
    );
  }
};
