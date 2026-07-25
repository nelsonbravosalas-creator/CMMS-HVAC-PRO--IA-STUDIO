import { getDb } from '../server/vercel/db.js';
import { getScopedTenantId, requireAuth } from '../server/vercel/auth.js';

type ExportPayload = {
  documentId?: unknown;
  documentType?: unknown;
  method?: unknown;
  clientId?: unknown;
  clientName?: unknown;
  assetTag?: unknown;
  pdfBase64?: unknown;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: any, res: any) {
  const resource = String(req.query?.handler || '');
  if (resource !== 'export') {
    return res.status(404).json({ success: false, error: 'Communications resource not found' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const user = requireAuth(req, res);
  if (!user) return;

  const payload = (req.body || {}) as ExportPayload;
  if (!payload.documentId || payload.method !== 'email') {
    return res.status(400).json({ success: false, error: 'Documento y método email son requeridos' });
  }
  if (!payload.pdfBase64 || typeof payload.pdfBase64 !== 'string') {
    return res.status(400).json({ success: false, error: 'El documento PDF es requerido para el envío' });
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

  try {
    const clientId = getScopedTenantId(user, payload.clientId);
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Seleccione un cliente antes de enviar el documento'
      });
    }

    const recipient = await resolveClientEmail(clientId);
    if (!recipient) {
      return res.status(422).json({
        success: false,
        error: 'El cliente seleccionado no tiene un correo de contacto válido',
        code: 'CLIENT_EMAIL_REQUIRED'
      });
    }

    const documentId = String(payload.documentId);
    const documentType = String(payload.documentType || 'documento');
    const attachment = payload.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
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
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[communications] Resend rejected message', { status: response.status, result });
      return res.status(502).json({
        success: false,
        error: 'El proveedor de correo rechazó el envío',
        code: 'EMAIL_PROVIDER_REJECTED'
      });
    }

    return res.status(202).json({
      success: true,
      message: `Documento enviado a ${recipient}`,
      recipientEmail: recipient,
      deliveryId: result.id
    });
  } catch (error: any) {
    console.error('[communications] export failed', error);
    return res.status(500).json({ success: false, error: 'No fue posible preparar la entrega del documento' });
  }
}

async function resolveClientEmail(clientId: string) {
  const sql = getDb();
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
