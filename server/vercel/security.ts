import { createHash, randomUUID } from 'node:crypto';

type SqlClient = (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>;

const normalizeForwardedIp = (value: unknown) =>
  String(value || 'unknown').split(',')[0].trim().slice(0, 128);

export function requestIp(req: any) {
  return normalizeForwardedIp(
    req.headers?.['x-real-ip']
      || req.headers?.['x-forwarded-for']
      || req.socket?.remoteAddress
  );
}

export function privacyHash(value: unknown) {
  const pepper = process.env.SECURITY_HASH_PEPPER || process.env.JWT_SECRET;
  if (!pepper && process.env.NODE_ENV === 'production') {
    throw new Error('SECURITY_HASH_PEPPER or JWT_SECRET is required in production');
  }
  return createHash('sha256')
    .update(`${pepper || 'development-only-pepper'}:${String(value || '')}`)
    .digest('hex');
}

export async function consumeRateLimit(
  sql: SqlClient,
  namespace: string,
  subject: string,
  limit: number,
  windowMs: number
) {
  const now = Date.now();
  const key = `${namespace}:${privacyHash(subject)}`;
  const rows = await sql`
    INSERT INTO cmms_rate_limits (key, count, window_started_at, expires_at)
    VALUES (${key}, 1, ${now}, ${now + windowMs})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN cmms_rate_limits.expires_at <= ${now} THEN 1
        ELSE cmms_rate_limits.count + 1
      END,
      window_started_at = CASE
        WHEN cmms_rate_limits.expires_at <= ${now} THEN ${now}
        ELSE cmms_rate_limits.window_started_at
      END,
      expires_at = CASE
        WHEN cmms_rate_limits.expires_at <= ${now} THEN ${now + windowMs}
        ELSE cmms_rate_limits.expires_at
      END
    RETURNING count, expires_at
  `;
  const count = Number(rows[0]?.count || 0);
  const expiresAt = Number(rows[0]?.expires_at || now + windowMs);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1000))
  };
}

export function rejectRateLimit(res: any, result: { retryAfterSeconds: number }) {
  res.setHeader('Retry-After', String(result.retryAfterSeconds));
  return res.status(429).json({
    success: false,
    error: 'Demasiadas solicitudes. Intente nuevamente más tarde.',
    code: 'RATE_LIMITED',
    retryAfter: result.retryAfterSeconds
  });
}

export function rejectOversizedRequest(req: any, res: any, maxBytes: number) {
  const contentLength = Number(req.headers?.['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    res.status(413).json({
      success: false,
      error: 'La solicitud excede el tamaño permitido.',
      code: 'PAYLOAD_TOO_LARGE'
    });
    return true;
  }
  return false;
}

export function rejectUntrustedOrigin(req: any, res: any) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(String(req.method || 'GET').toUpperCase())) return false;
  const origin = String(req.headers?.origin || '').trim();
  if (!origin) return false;
  const protocol = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  const allowed = new Set([
    `${protocol}://${host}`,
    String(process.env.APP_URL || '').replace(/\/$/, '')
  ].filter(Boolean));
  if (allowed.has(origin.replace(/\/$/, ''))) return false;
  res.status(403).json({ success: false, error: 'Origen de solicitud no permitido', code: 'UNTRUSTED_ORIGIN' });
  return true;
}

export async function writeSecurityAudit(
  sql: SqlClient,
  event: {
    action: string;
    entityType: string;
    entityId: string;
    userId?: string | null;
    tenantId?: string | null;
    outcome: 'success' | 'failure' | 'denied';
    details?: Record<string, unknown>;
  }
) {
  const timestamp = Date.now();
  const payload = JSON.stringify({
    outcome: event.outcome,
    ...(event.details || {})
  });
  try {
    await sql`
      INSERT INTO audit_logs (
        id, action, entity_type, entity_id, user_id, payload, timestamp, cliente_id
      ) VALUES (
        ${randomUUID()}, ${event.action}, ${event.entityType}, ${event.entityId},
        ${event.userId || 'anonymous'}, ${payload}, ${timestamp}, ${event.tenantId || null}
      )
    `;
  } catch (error) {
    // La auditoría nunca debe filtrar secretos ni reemplazar la respuesta del flujo.
    console.error('[security-audit] failed to persist event', {
      action: event.action,
      entityType: event.entityType,
      outcome: event.outcome
    });
  }
}

export async function emitOperationalAlert(
  event: string,
  severity: 'warning' | 'error' | 'critical',
  details: Record<string, unknown> = {}
) {
  const alert = {
    source: 'cmms-hvac-pro',
    event,
    severity,
    timestamp: new Date().toISOString(),
    details
  };
  console.error(JSON.stringify(alert));

  const webhook = String(process.env.SECURITY_ALERT_WEBHOOK_URL || '').trim();
  if (!webhook) return;
  let url: URL;
  try {
    url = new URL(webhook);
  } catch {
    console.error('[security-alert] invalid webhook URL');
    return;
  }
  if (url.protocol !== 'https:') {
    console.error('[security-alert] webhook must use HTTPS');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.SECURITY_ALERT_WEBHOOK_TOKEN
        ? { Authorization: `Bearer ${process.env.SECURITY_ALERT_WEBHOOK_TOKEN}` }
        : {})
    },
    body: JSON.stringify(alert),
    signal: controller.signal
  }).catch((error) => {
    console.error('[security-alert] delivery failed', error instanceof Error ? error.message : 'unknown');
  }).finally(() => clearTimeout(timeout));
}

export function isValidCredential(value: unknown) {
  return /^\d{6}$/.test(String(value || '').trim());
}
