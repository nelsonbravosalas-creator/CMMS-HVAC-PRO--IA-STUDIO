import { BaseRepository } from './BaseRepository';
import { LocalActivo } from '../db/database';

class ActivosRepository extends BaseRepository<LocalActivo> {
  constructor() {
    super('activos');
  }

  async getByTag(tag: string): Promise<LocalActivo | undefined> {
    return this.table.where('tag').equals(tag).first();
  }
}

export const activosRepo = new ActivosRepository();
