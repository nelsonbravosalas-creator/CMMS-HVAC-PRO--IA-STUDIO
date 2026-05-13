import { BaseRepository } from './BaseRepository';
import { LocalMantenimiento } from '../lib/dbLocal';

export class MantenimientosRepository extends BaseRepository<LocalMantenimiento> {
  constructor() {
    super('mantenimientos');
  }

  async getByAsset(assetTag: string): Promise<LocalMantenimiento[]> {
    return this.table.where('equipo_tag').equals(assetTag).toArray();
  }
}

export const mantenimientosRepo = new MantenimientosRepository();
