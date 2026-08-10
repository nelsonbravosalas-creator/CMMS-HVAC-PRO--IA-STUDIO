import { getDb } from '../server/vercel/db.js';
import { getScopedTenantId, requireAuth } from '../server/vercel/auth.js';
import {
  consumeRateLimit,
  emitOperationalAlert,
  rejectOversizedRequest,
  rejectRateLimit,
  writeSecurityAudit
} from '../server/vercel/security.js';

type ExportPayload = {
  documentId?: unknown;
  documentType?: unknown;
  method?: unknown;
  clientId?: unknown;
  clientName?: unknown;
  assetTag?: unknown;
  pdfBase64?: unknown;
  idempotencyKey?: unknown;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOCUMENT_TYPES = new Set(['maintenance', 'work_order', 'ticket', 'efficiency_report', 'reports']);
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;
const MAX_PDF_BYTES = 3 * 1024 * 1024;

export default async function handler(req: any, res: any) {
  const resource = String(req.query?.handler || '');
  if (resource !== 'export') {
    return res.status(404).json({ success: false, error: 'Communications resource not found' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  if (rejectOversizedRequest(req, res, MAX_REQUEST_BYTES)) return;

  const sql = getDb();
  const user = await requireAuth(req, res, sql);
  if (!user) return;

  const payload = (req.body || {}) as ExportPayload;
  if (!payload.documentId || payload.method !== 'email') {
    return res.status(400).json({ success: false, error: 'Documento y método email son requeridos' });
  }
  if (!payload.pdfBase64 || typeof payload.pdfBase64 !== 'string') {
    return res.status(400).json({ success: false, error: 'El documento PDF es requerido para el envío' });
  }
  const documentType = String(payload.documentType || '');
  const documentId = String(payload.documentId || '').trim();
  const idempotencyKey = String(payload.idempotencyKey || req.headers?.['idempotency-key'] || '').trim();
  if (!DOCUMENT_TYPES.has(documentType) || !documentId || documentId.length > 160) {
    return res.status(400).json({ success: false, error: 'Tipo o identificador de documento inválido' });
  }
  if (!/^[a-f0-9-]{36}$/i.test(idempotencyKey)) {
    return res.status(400).json({ success: false, error: 'Se requiere una clave de idempotencia válida' });
  }
  if (!payload.pdfBase64.startsWith('data:application/pdf;base64,')) {
    return res.status(400).json({ success: false, error: 'El adjunto debe ser un PDF Base64 válido' });
  }
  const attachment = payload.pdfBase64.slice('data:application/pdf;base64,'.length);
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(attachment)) {
    return res.status(400).json({ success: false, error: 'El contenido Base64 del PDF es inválido' });
  }
  const pdfBytes = Buffer.from(attachment, 'base64');
  if (pdfBytes.length === 0 || pdfBytes.length > MAX_PDF_BYTES || pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return res.status(413).json({ success: false, error: 'El PDF es inválido o excede 3 MB', code: 'PDF_INVALID_OR_TOO_LARGE' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return res.status(503).json({
      success: false,
      error: 'Entrega de correo no configurada',
      code: 'EMAIL_NOT_CONFIGURED'
    });
  }

  const userId = String(user.uuid_sync || user.id);
  let idempotencyClaimed = false;
  try {
    const clientId = getScopedTenantId(user, payload.clientId);
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Seleccione un cliente antes de enviar el documento'
      });
    }
    const recipient = await resolveClientEmail(sql, clientId);
    if (!recipient) {
      return res.status(422).json({
        success: false,
        error: 'El cliente seleccionado no tiene un correo de contacto válido',
        code: 'CLIENT_EMAIL_REQUIRED'
      });
    }

    const [userLimit, tenantLimit] = await Promise.all([
      consumeRateLimit(sql, 'email-user', userId, 10, 60 * 60 * 1000),
      consumeRateLimit(sql, 'email-tenant', clientId, 50, 24 * 60 * 60 * 1000)
    ]);
    const rejectedLimit = [userLimit, tenantLimit].find((result) => !result.allowed);
    if (rejectedLimit) return rejectRateLimit(res, rejectedLimit);

    const claimedKeys = await sql`
      INSERT INTO cmms_idempotency_keys (key, user_id, status_code, response_body, expires_at)
      VALUES (${idempotencyKey}, ${userId}, 102, ${JSON.stringify({ state: 'processing' })}, ${new Date(Date.now() + 24 * 60 * 60 * 1000)})
      ON CONFLICT (key, user_id) DO NOTHING
      RETURNING key
    `;
    if (claimedKeys.length === 0) {
      const previous = await sql`
        SELECT status_code, response_body FROM cmms_idempotency_keys
        WHERE key = ${idempotencyKey} AND user_id = ${userId}
        LIMIT 1
      `;
      if (Number(previous[0]?.status_code) === 202) {
        return res.status(202).json(previous[0].response_body);
      }
      return res.status(409).json({ success: false, error: 'El envío ya está en proceso', code: 'REQUEST_IN_PROGRESS' });
    }
    idempotencyClaimed = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          from,
          to: [recipient],
          subject: `CMMS HVAC · ${documentType} ${documentId}`,
          html: `<p>Adjuntamos el documento <strong>${escapeHtml(documentId)}</strong> generado por CMMS HVAC.</p>`,
          attachments: [{
            filename: `${safeFilename(documentType)}-${safeFilename(documentId)}.pdf`,
            content: attachment
          }],
          tags: [
            { name: 'document_type', value: safeTag(documentType) },
            { name: 'document_id', value: safeTag(documentId) }
          ]
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[communications] Resend rejected message', { status: response.status, result });
      await writeSecurityAudit(sql, {
        action: 'communication.email', entityType: documentType, entityId: documentId,
        userId: user.uuid_sync || user.id, tenantId: clientId, outcome: 'failure',
        details: { providerStatus: response.status }
      });
      await emitOperationalAlert('communication.provider_rejected', 'error', {
        tenantId: clientId,
        documentType,
        providerStatus: response.status
      });
      await sql`DELETE FROM cmms_idempotency_keys WHERE key = ${idempotencyKey} AND user_id = ${userId}`;
      return res.status(502).json({
        success: false,
        error: 'El proveedor de correo rechazó el envío',
        code: 'EMAIL_PROVIDER_REJECTED'
      });
    }

    const responseBody = {
      success: true,
      message: `Documento enviado a ${recipient}`,
      recipientEmail: recipient,
      deliveryId: result.id
    };
    await sql`
      UPDATE cmms_idempotency_keys
      SET status_code = 202, response_body = ${JSON.stringify(responseBody)}
      WHERE key = ${idempotencyKey} AND user_id = ${userId}
    `;
    await writeSecurityAudit(sql, {
      action: 'communication.email', entityType: documentType, entityId: documentId,
      userId: user.uuid_sync || user.id, tenantId: clientId, outcome: 'success',
      details: { deliveryId: result.id }
    });
    return res.status(202).json(responseBody);
  } catch (error: any) {
    if (idempotencyClaimed) {
      await sql`DELETE FROM cmms_idempotency_keys WHERE key = ${idempotencyKey} AND user_id = ${userId}`.catch(() => undefined);
    }
    console.error('[communications] export failed', error);
    await emitOperationalAlert('communication.export_failed', 'error', {
      documentType,
      reason: error?.name === 'AbortError' ? 'timeout' : 'internal_error'
    });
    return res.status(500).json({ success: false, error: 'No fue posible preparar la entrega del documento' });
  }
}

async function resolveClientEmail(sql: any, clientId: string) {
  const rows = await sql`
    SELECT data
    FROM clientes
    WHERE (id = ${clientId} OR uuid_sync = ${clientId})
      AND deleted_at IS NULL
    LIMIT 1
  `;
  const data = rows[0]?.data || {};
  const email = String(data.email || data.contacto_email || data.contactoCorreo || '').trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

function safeFilename(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'documento';
}

function safeTag(value: string) {
  return value.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 256) || 'document';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
}
