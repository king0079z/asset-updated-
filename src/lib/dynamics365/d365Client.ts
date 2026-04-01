/**
 * Microsoft Dynamics 365 Finance & Operations REST client.
 * Uses MSAL client credentials flow (app-to-app authentication).
 * Falls back to mock adapter when credentials are not configured.
 */

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getD365AccessToken(): Promise<string | null> {
  const tenantId = process.env.D365_TENANT_ID;
  const clientId = process.env.D365_CLIENT_ID;
  const clientSecret = process.env.D365_CLIENT_SECRET;
  const environmentUrl = process.env.D365_ENVIRONMENT_URL;

  if (!tenantId || !clientId || !clientSecret || !environmentUrl) return null;

  // Return cached token if still valid
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const scope = `${environmentUrl}/.default`;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`D365 token error: ${err}`);
  }

  const data = await response.json();
  const expiresAt = Date.now() + (data.expires_in - 300) * 1000;
  tokenCache = { token: data.access_token, expiresAt };
  return data.access_token;
}

export async function d365Request(path: string, method = 'GET', body?: any): Promise<any> {
  const environmentUrl = process.env.D365_ENVIRONMENT_URL;
  if (!environmentUrl) throw new Error('D365_ENVIRONMENT_URL not configured');

  const token = await getD365AccessToken();
  if (!token) throw new Error('Could not obtain D365 access token');

  const url = `${environmentUrl}/api/data/v9.2/${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`D365 API error ${res.status}: ${err}`);
  }

  return method === 'DELETE' ? { ok: true } : res.json();
}

export function isD365Configured(): boolean {
  return !!(
    process.env.D365_TENANT_ID &&
    process.env.D365_CLIENT_ID &&
    process.env.D365_CLIENT_SECRET &&
    process.env.D365_ENVIRONMENT_URL
  );
}
