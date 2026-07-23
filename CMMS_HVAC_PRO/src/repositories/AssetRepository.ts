import { BaseRepository } from './BaseRepository';
import { LocalActivo } from '../db/database';

class ActivosRepository extends BaseRepository<LocalActivo> {
  constructor() {
    super('assets');
  }

  async getByTag(tag: string): Promise<LocalActivo | undefined> {
    return this.table.where('tag').equals(tag).first();
  }

  async getByUuid(uuidSync: string): Promise<LocalActivo | undefined> {
    return this.table.get(uuidSync);
  }
}

export const assetsRepo = new ActivosRepository();
