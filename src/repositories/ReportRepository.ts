import { BaseRepository } from './BaseRepository';
import { LocalInforme } from '../db/database';

export class ReportRepository extends BaseRepository<LocalInforme> {
  constructor() {
    super('reports');
  }
}

export const reportRepo = new ReportRepository();
