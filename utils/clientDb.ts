import { openDB } from 'idb';

export interface ClientData {
  id?: number;
  name: string;
  nit: string;
  nrc: string;
  activity: string;
  address: string;
  phone: string;
  email: string;
  timestamp: number;
}

const DB_NAME = 'dte-clients-db';
const DB_VERSION = 1;
const STORE_NAME = 'clients';

export const openClientsDb = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('nit', 'nit', { unique: false }); // Allow multiple entries? Maybe unique is better but let's be flexible
      }
    },
  });
};

export const addClient = async (client: Omit<ClientData, 'id'>): Promise<void> => {
  const db = await openClientsDb();
  await db.add(STORE_NAME, client);
};

export const getClients = async (): Promise<ClientData[]> => {
  const db = await openClientsDb();
  const all = await db.getAll(STORE_NAME);
  return all.sort((a, b) => b.timestamp - a.timestamp);
};

export const deleteClient = async (id: number): Promise<void> => {
  const db = await openClientsDb();
  await db.delete(STORE_NAME, id);
};
