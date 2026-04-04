import { openDB, type IDBPDatabase } from 'idb';
import type { SavedDiscussion } from '@/types';

const DB_NAME = 'roundtable-db';
const DB_VERSION = 1;
const STORE_NAME = 'discussions';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export const storageService = {
  async saveDiscussion(disc: SavedDiscussion): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, {
      ...disc,
      updatedAt: new Date(),
    });
  },

  async loadDiscussion(id: string): Promise<SavedDiscussion | undefined> {
    const db = await getDB();
    const result = await db.get(STORE_NAME, id);
    return result as SavedDiscussion | undefined;
  },

  async listDiscussions(): Promise<SavedDiscussion[]> {
    const db = await getDB();
    const all = await db.getAll(STORE_NAME);
    return (all as SavedDiscussion[]).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  async deleteDiscussion(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
  },
};
