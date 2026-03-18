import { API_URL } from '@/constants/config';
import { supabase } from '@/lib/supabase';

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T = unknown>(
  path: string,
  options: { method?: ApiMethod; body?: object; headers?: Record<string, string> } = {}
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const url = path.startsWith('http') ? path : `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.error || `Request failed: ${res.status}`);
  }

  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined as T;
  }
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
export interface DashboardStats {
  totalAssets: number;
  totalFoodItems: number;
  activeVehicleRentals: number;
  lowStockItems: number;
  totalFoodCost: number;
  totalVehicleCost: number;
  assetStats: { byStatus: { status: string; count: number }[]; totalValue: number; disposedValue: number };
}
export async function getDashboardStats(): Promise<DashboardStats> {
  return api<DashboardStats>('/api/dashboard/stats');
}

// ─── Assets ───────────────────────────────────────────────────────────────
export async function getAssets(params?: { search?: string }) {
  const q = params?.search ? `?search=${encodeURIComponent(params.search)}` : '';
  const d = await api<any>(`/api/assets${q}`);
  if (Array.isArray(d)) return d;
  return d?.assets ?? [];
}

export async function getMyAssets() {
  const d = await api<any>('/api/assets/mine');
  return Array.isArray(d) ? d : d?.assets ?? [];
}

export async function getAsset(id: string) {
  const res = await api<any>(`/api/assets/${id}`);
  return res?.asset ?? res;
}

export async function scanAsset(query: string) {
  const res = await api<{ asset?: any }>(`/api/assets/scan?q=${encodeURIComponent(query)}`);
  return res?.asset ?? null;
}

export async function updateAssetStatus(id: string, status: string) {
  return api(`/api/assets/${id}`, { method: 'PATCH', body: { status } });
}

export async function moveAsset(id: string, floorNumber?: string, roomNumber?: string, locationId?: string) {
  return api(`/api/assets/${id}/move`, { method: 'POST', body: { floorNumber, roomNumber, locationId } });
}

export async function postAuditComment(id: string, comment: string, imageUrl?: string) {
  return api(`/api/assets/${id}/audit-comment`, { method: 'POST', body: { comment, imageUrl } });
}

// ─── Tickets ──────────────────────────────────────────────────────────────
export async function getAssignedTickets() {
  const d = await api<any>('/api/tickets/assigned');
  return Array.isArray(d) ? d : d?.tickets ?? [];
}

export async function getTicket(id: string) {
  return api<any>(`/api/tickets/${id}`);
}

export async function updateTicketStatus(id: string, status: string) {
  return api(`/api/tickets/${id}`, { method: 'PATCH', body: { status } });
}

// ─── Tasks (Planner) ──────────────────────────────────────────────────────
export async function getAssignedTasks() {
  const d = await api<any>('/api/planner/assigned');
  return Array.isArray(d) ? d : d?.tasks ?? [];
}

export async function getTask(id: string) {
  return api<any>(`/api/planner/${id}`);
}

export async function updateTaskStatus(id: string, status: string) {
  return api(`/api/planner/${id}`, { method: 'PATCH', body: { status } });
}
