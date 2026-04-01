import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('assetxai_offline.db');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        body TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        retries INTEGER DEFAULT 0
      );
    `);
  }
  return db;
}

export interface QueuedAction {
  id: number;
  action: string;
  endpoint: string;
  method: string;
  body: string | null;
  createdAt: string;
  retries: number;
}

export async function enqueueAction(action: string, endpoint: string, method: string, body?: object): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'INSERT INTO offline_queue (action, endpoint, method, body) VALUES (?, ?, ?, ?)',
    [action, endpoint, method, body ? JSON.stringify(body) : null]
  );
}

export async function getPendingActions(): Promise<QueuedAction[]> {
  const database = await getDb();
  return database.getAllAsync<QueuedAction>('SELECT * FROM offline_queue ORDER BY createdAt ASC');
}

export async function removeAction(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM offline_queue WHERE id = ?', [id]);
}

export async function syncOfflineQueue(apiClient: (endpoint: string, opts: any) => Promise<any>): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingActions();
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      await apiClient(item.endpoint, {
        method: item.method,
        body: item.body ? JSON.parse(item.body) : undefined,
      });
      await removeAction(item.id);
      synced++;
    } catch {
      failed++;
      const database = await getDb();
      await database.runAsync('UPDATE offline_queue SET retries = retries + 1 WHERE id = ?', [item.id]);
    }
  }

  return { synced, failed };
}
