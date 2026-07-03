import { createRxDatabase } from 'rxdb';
import type { RxDatabase, RxCollection } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { userSchema, scanSchema } from './schemas';
import type { UserDocType, ScanDocType } from './schemas';

// Define the collections mapping
export type KisanTraceCollections = {
  users: RxCollection<UserDocType>;
  scans: RxCollection<ScanDocType>;
};

// Define the database type
export type KisanTraceDatabase = RxDatabase<KisanTraceCollections>;

let dbPromise: Promise<KisanTraceDatabase> | null = null;

/**
 * Initializes and returns the singleton RxDatabase instance.
 * Uses Dexie as the underlying storage engine for IndexedDB.
 */
export const getDatabase = async (): Promise<KisanTraceDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    // 1. Create the database
    const db = await createRxDatabase<KisanTraceCollections>({
      name: 'kisantrace_v2',
      storage: getRxStorageDexie(),
      multiInstance: false, // Disabled to resolve DB9 conflicts in some environments
      ignoreDuplicate: true, // Prevents errors during hot-module-replacement (HMR) in Vite
    });

    // 2. Add the collections with their respective schemas
    await db.addCollections({
      users: {
        schema: userSchema,
      },
      scans: {
        schema: scanSchema,
      },
    });

    return db;
  })();

  return dbPromise;
};

// Handle Hot Module Replacement (HMR) to prevent RxError (DB9)
// @ts-ignore
if (import.meta.hot) {
  // @ts-ignore
  import.meta.hot.dispose(async () => {
    if (dbPromise) {
      const db = await dbPromise;
      await db.destroy();
      dbPromise = null;
    }
  });
}
