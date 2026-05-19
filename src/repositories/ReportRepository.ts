import { BaseRepository } from './BaseRepository';
import { LocalInforme } from '../db/database';

class InformesRepository extends BaseRepository<LocalInforme> {
  constructor() {
    super('reports');
  }
}

export const reportsRepo = new InformesRepository();
