import { BaseRepository } from './BaseRepository';
import { LocalSucursal } from '../db/database';

export class BranchRepository extends BaseRepository<LocalSucursal> {
  constructor() {
    super('branches');
  }

  async getByClient(clientId: string): Promise<LocalSucursal[]> {
    return this.table.where('cliente_id').equals(clientId).toArray();
  }
}

export const branchRepo = new BranchRepository();
