import { LocalCliente } from '../db/database';

export type ExportMethod = 'email' | 'whatsapp' | 'share';

export interface ExportPayload {
  documentId: string;
  documentType: 'maintenance' | 'work_order' | 'ticket' | 'efficiency_report';
  method: ExportMethod;
  clientId?: string;
  clientName?: string;
  assetTag?: string;
  pdfBase64?: string; // Generated on the client side
}

export class DocumentExportService {
  /**
   * Unified service method to manage document attachment and sending.
   */
  static async exportDocument(payload: ExportPayload): Promise<{ success: boolean; message: string; recipientEmail?: string }> {
    try {
      // 1. Prepare export request to API
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('auth_token') ? { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export document');
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error(`[ExportService] Error exporting document [${payload.documentId}]:`, error);
      throw error;
    }
  }
}
