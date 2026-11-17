import { LocalObra, LocalParticipanteObra } from '../db/database';
import { BaseRepository } from './BaseRepository';

export class ObraRepository extends BaseRepository<LocalObra> {
  constructor() {
    super('obras');
  }

  async getByClient(clientId: string): Promise<LocalObra[]> {
    const rows = await this.table.where('cliente_id').equals(clientId).toArray();
    return rows.filter((r) => !r.deleted_at && r.sync_status !== 'pending_delete');
  }
}

export class ParticipanteObraRepository extends BaseRepository<LocalParticipanteObra> {
  constructor() {
    super('participantes_obra');
  }

  async getByObra(obraId: string): Promise<LocalParticipanteObra[]> {
    const rows = await this.table.where('obra_id').equals(obraId).toArray();
    return rows.filter((r) => !r.deleted_at && r.sync_status !== 'pending_delete');
  }
}

export const obraRepo = new ObraRepository();
export const participanteObraRepo = new ParticipanteObraRepository();
