
import { db } from "../db/database";
import { logger } from "./logger";

/**
 * Servicio de Exportación e Importación en formato XML (Respaldo Maestro).
 * Permite mapear toda la base de datos local a un archivo estructurado.
 */
export const xmlSyncService = {
  /**
   * Exporta todas las tablas de IndexedDB a un archivo XML.
   */
  async exportToXML() {
    try {
      logger.info("XMLSync", "Iniciando exportación maestra a XML...");
      
      const tables = ["assets", "users", "preventive_maintenance", "work_orders", "reports", "events", "clients", "branches"];
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<CMMS_HVAC_PRO_BACKUP version="2.0" timestamp="${new Date().toISOString()}">\n`;

      for (const tableName of tables) {
        const table: any = (db as any)[tableName];
        if (!table) continue;
        
        const records = await table.toArray();
        xml += `  <Table name="${tableName}">\n`;
        
        for (const record of records) {
          xml += `    <Record>\n`;
          for (const [key, value] of Object.entries(record)) {
            const sanitizedValue = this.escapeXml(String(typeof value === 'object' ? JSON.stringify(value) : value));
            xml += `      <${key}>${sanitizedValue}</${key}>\n`;
          }
          xml += `    </Record>\n`;
        }
        
        xml += `  </Table>\n`;
      }

      xml += `</CMMS_HVAC_PRO_BACKUP>`;

      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HVAC_PRO_BACKUP_${new Date().toISOString().split('T')[0]}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      logger.info("XMLSync", "Exportación XML completada con éxito.");
      return true;
    } catch (error) {
      logger.error("XMLSync", "Error en exportación XML", error);
      throw error;
    }
  },

  /**
   * Importa datos desde un archivo XML al almacenamiento local (Dexie).
   */
  async importFromXML(file: File) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(content, "text/xml");
          
          if (xmlDoc.getElementsByTagName("CMMS_HVAC_PRO_BACKUP").length === 0) {
            throw new Error("Formato XML inválido o no compatible.");
          }

          const tables = xmlDoc.getElementsByTagName("Table");
          let totalImported = 0;

          for (let i = 0; i < tables.length; i++) {
            const tableName = tables[i].getAttribute("name");
            const table: any = (db as any)[tableName!];
            
            if (table) {
              const records = tables[i].getElementsByTagName("Record");
              for (let j = 0; j < records.length; j++) {
                const recordData: any = {};
                const children = records[j].children;
                for (let k = 0; k < children.length; k++) {
                  const nodeName = children[k].nodeName;
                  const nodeValue = children[k].textContent;
                  
                  // Intentar parsear JSON si parece un objeto/array
                  try {
                    if (nodeValue?.startsWith('{') || nodeValue?.startsWith('[')) {
                      recordData[nodeName] = JSON.parse(nodeValue);
                    } else if (nodeValue === 'true') {
                      recordData[nodeName] = true;
                    } else if (nodeValue === 'false') {
                      recordData[nodeName] = false;
                    } else if (!isNaN(Number(nodeValue)) && nodeValue !== '') {
                      recordData[nodeName] = Number(nodeValue);
                    } else {
                      recordData[nodeName] = nodeValue;
                    }
                  } catch {
                    recordData[nodeName] = nodeValue;
                  }
                }

                // Importar o actualizar con conflicto a favor de lo nuevo
                if (recordData.uuid_sync) {
                   await table.put({
                     ...recordData,
                     sync_status: 'pending', // Forzar sincronización de lo importado
                     updated_at: Date.now()
                   });
                   totalImported++;
                }
              }
            }
          }

          logger.info("XMLSync", `Importación completada. ${totalImported} registros procesados.`);
          resolve(totalImported);
        } catch (error) {
          logger.error("XMLSync", "Error en importación XML", error);
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  },

  escapeXml(unsafe: string) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
};
