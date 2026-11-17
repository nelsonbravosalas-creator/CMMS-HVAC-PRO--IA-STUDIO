import { LocalAcuse, LocalAnotacion } from '../db/database';
import { BaseRepository } from './BaseRepository';
import { puedeModificarAnotacion, validarBorrador, type AnotacionBorrador } from '../../server/libroObra';

export class AnotacionRepository extends BaseRepository<LocalAnotacion> {
  constructor() {
    super('anotaciones');
  }

  /** Anotaciones de una obra: primero las emitidas por folio, después los borradores por hora. */
  async getByObra(obraId: string): Promise<LocalAnotacion[]> {
    const rows = await this.table.where('obra_id').equals(obraId).toArray();
    return rows
      .filter((r) => !r.deleted_at && r.sync_status !== 'pending_delete')
      .sort((a, b) => {
        if (a.folio && b.folio) return a.folio - b.folio;
        if (a.folio) return -1;
        if (b.folio) return 1;
        return a.escrito_en - b.escrito_en;
      });
  }

  /** R16: una anotación con folio no se edita; el error se corrige con otra anotación. */
  async update(uuid: string, data: Partial<LocalAnotacion>): Promise<LocalAnotacion> {
    const existente = await this.getById(uuid);
    if (existente && !puedeModificarAnotacion(existente)) {
      throw new Error('Una anotación emitida no se edita; emita una corrección');
    }
    return super.update(uuid, data);
  }

  async delete(uuid: string): Promise<void> {
    const existente = await this.getById(uuid);
    if (existente && !puedeModificarAnotacion(existente)) {
      throw new Error('Una anotación emitida no se borra; emita una corrección');
    }
    return super.delete(uuid);
  }

  /**
   * Firma y guarda la anotación en el dispositivo. El servidor asigna folio y hash al
   * sincronizar; mientras tanto queda como borrador firmado (R26).
   */
  async emitir(borrador: AnotacionBorrador & { cliente_id: string }): Promise<LocalAnotacion> {
    const errores = validarBorrador(borrador);
    if (errores.length) throw new Error(errores.join('. '));
    return this.create(borrador as unknown as Omit<LocalAnotacion, 'uuid_sync' | 'updated_at' | 'sync_status'>);
  }
}

export class AcuseRepository extends BaseRepository<LocalAcuse> {
  constructor() {
    super('anotacion_acuses');
  }

  async getByObra(obraId: string): Promise<LocalAcuse[]> {
    return this.table.where('obra_id').equals(obraId).toArray();
  }
}

export const anotacionRepo = new AnotacionRepository();
export const acuseRepo = new AcuseRepository();
