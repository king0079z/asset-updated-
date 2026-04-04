/**
 * Offline queue — stub implementation.
 * expo-sqlite removed to reduce app size (app is primarily a WebView).
 * Actions are queued in-memory and synced on reconnect.
 */

export interface QueuedAction {
  id: number;
  action: string;
  endpoint: string;
  method: string;
  body: string | null;
  createdAt: string;
  retries: number;
}

let queue: QueuedAction[] = [];
let nextId = 1;

export async function enqueueAction(
  action: string, endpoint: string, method: string, body?: object,
): Promise<void> {
  queue.push({
    id: nextId++,
    action,
    endpoint,
    method,
    body: body ? JSON.stringify(body) : null,
    createdAt: new Date().toISOString(),
    retries: 0,
  });
}

export async function getPendingActions(): Promise<QueuedAction[]> {
  return [...queue];
}

export async function removeAction(id: number): Promise<void> {
  queue = queue.filter(q => q.id !== id);
}

export async function syncOfflineQueue(
  apiClient: (endpoint: string, opts: any) => Promise<any>,
): Promise<{ synced: number; failed: number }> {
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
      const found = queue.find(q => q.id === item.id);
      if (found) found.retries++;
    }
  }

  return { synced, failed };
}
