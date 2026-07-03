/**
 * sync-service.ts
 *
 * Implements the RxDB replication protocol to synchronize local data with the
 * Node.js backend (`server-api`).
 *
 * This uses the custom GraphQL/REST replication plugin from RxDB. It is configured
 * to exactly match the endpoints built in `server-api/src/routes/sync.route.ts`.
 */

import { replicateRxCollection } from 'rxdb/plugins/replication';
import type { RxCollection } from 'rxdb';

// Fallback to localhost if the env var isn't set
const SYNC_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/sync';

export interface SyncCheckpoint {
  updatedAt: string;
}

/**
 * Sets up bidirectional, live replication for a given RxDB collection.
 * 
 * @param collection The RxDB collection (e.g., db.scans or db.users)
 * @param collectionName The name of the endpoint ('scans' or 'users')
 * @returns The replication state object to monitor errors or activity
 */
export function setupCollectionSync(
  collection: RxCollection,
  collectionName: 'scans' | 'users'
) {
  const url = `${SYNC_URL}/${collectionName}`;

  const replicationState = replicateRxCollection<any, SyncCheckpoint>({
    collection,
    // Unique ID so RxDB knows where to store the checkpoint locally
    replicationIdentifier: `kisan-trace-${collectionName}-sync-v1`,
    
    // Live mode: automatically pushes local changes and optionally polls
    live: true,
    retryTime: 5000, // Exponential backoff is handled automatically by RxDB

    // PULL: Fetch updates from the server
    pull: {
      handler: async (lastCheckpoint: SyncCheckpoint | undefined, batchSize: number) => {
        const limitQuery = `limit=${batchSize}`;
        const checkpointQuery = lastCheckpoint ? `&checkpoint=${encodeURIComponent(lastCheckpoint.updatedAt)}` : '';
        
        try {
          const response = await fetch(`${url}/pull?${limitQuery}${checkpointQuery}`);
          if (!response.ok) {
            throw new Error(`Failed to pull ${collectionName}: ${response.statusText}`);
          }
          
          const data = await response.json();
          return {
            documents: data.documents,
            // If the server returns null for checkpoint (no new docs),
            // we MUST return the previous checkpoint to avoid losing our place.
            checkpoint: data.checkpoint === null ? lastCheckpoint : data.checkpoint,
          };
        } catch (error) {
          console.error(`[Sync Pull Error - ${collectionName}]`, error);
          throw error;
        }
      },
    },

    // PUSH: Send local changes to the server
    push: {
      handler: async (docs) => {
        try {
          const response = await fetch(`${url}/push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ documents: docs }),
          });

          if (!response.ok) {
            throw new Error(`Failed to push ${collectionName}: ${response.statusText}`);
          }

          // Our server uses Last-Writer-Wins (LWW) and returns an empty array for conflicts
          const conflicts = await response.json();
          return conflicts; 
        } catch (error) {
          console.error(`[Sync Push Error - ${collectionName}]`, error);
          throw error;
        }
      },
    },
  });

  // Optional: Monitor errors (useful for the "Flapping Signal" edge case)
  replicationState.error$.subscribe(error => {
    console.warn(`[RxDB Sync Warning - ${collectionName}] Network issue or conflict:`, error);
  });

  return replicationState;
}

/**
 * Initialize sync for all collections in the database.
 * This should be called right after getDatabase() initializes the DB.
 */
export function startGlobalSync(db: any) {
  const scansSync = setupCollectionSync(db.scans, 'scans');
  const usersSync = setupCollectionSync(db.users, 'users');

  return { scansSync, usersSync };
}
