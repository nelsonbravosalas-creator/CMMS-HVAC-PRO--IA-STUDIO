export const PENDING_ASSET_PATH_KEY = 'pending_asset_path';
export const PENDING_ASSET_CLIENT_KEY = 'pending_asset_client';

const ASSET_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const CLIENT_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;

export interface PendingAssetDestination {
  path: string;
  clientId: string | null;
}

export function parseAssetDestination(rawUrl: string): PendingAssetDestination | null {
  let url: URL;
  try {
    url = new URL(rawUrl, 'https://cmms.invalid');
  } catch {
    return null;
  }

  const match = url.pathname.match(/^\/equipos\/([^/]+)\/?$/i);
  if (!match) return null;

  let assetIdentifier: string;
  try {
    assetIdentifier = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  if (!ASSET_IDENTIFIER_PATTERN.test(assetIdentifier)) return null;

  const requestedClient = String(url.searchParams.get('cliente') || '').trim();
  const clientId = requestedClient && CLIENT_IDENTIFIER_PATTERN.test(requestedClient)
    ? requestedClient
    : null;

  return {
    path: `/equipos/${encodeURIComponent(assetIdentifier)}`,
    clientId
  };
}

export function assetQrUrl(
  origin: string,
  assetIdentifier: string,
  clientId?: string | null
): string {
  const url = new URL(`/equipos/${encodeURIComponent(assetIdentifier)}`, origin);
  if (clientId && CLIENT_IDENTIFIER_PATTERN.test(clientId)) {
    url.searchParams.set('cliente', clientId);
  }
  return url.toString();
}

export function resolvePendingAssetClient(
  destination: PendingAssetDestination | null,
  allowedClientIds: Array<string | null | undefined>
): string | null {
  const allowed = [...new Set(allowedClientIds.filter((value): value is string => Boolean(value)))];
  if (destination?.clientId && allowed.includes(destination.clientId)) {
    return destination.clientId;
  }
  if (destination && !destination.clientId && allowed.length === 1) {
    return allowed[0];
  }
  return null;
}

export function storePendingAssetDestination(destination: PendingAssetDestination): void {
  localStorage.setItem(PENDING_ASSET_PATH_KEY, destination.path);
  if (destination.clientId) {
    localStorage.setItem(PENDING_ASSET_CLIENT_KEY, destination.clientId);
  } else {
    localStorage.removeItem(PENDING_ASSET_CLIENT_KEY);
  }
}

export function readPendingAssetDestination(): PendingAssetDestination | null {
  const path = localStorage.getItem(PENDING_ASSET_PATH_KEY);
  if (!path) return null;
  const parsed = parseAssetDestination(path);
  if (!parsed) {
    clearPendingAssetDestination();
    return null;
  }
  return {
    path: parsed.path,
    clientId: localStorage.getItem(PENDING_ASSET_CLIENT_KEY)
  };
}

export function clearPendingAssetDestination(): void {
  localStorage.removeItem(PENDING_ASSET_PATH_KEY);
  localStorage.removeItem(PENDING_ASSET_CLIENT_KEY);
}
