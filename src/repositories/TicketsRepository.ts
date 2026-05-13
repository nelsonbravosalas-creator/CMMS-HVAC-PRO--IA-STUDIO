import { BaseRepository } from './BaseRepository';
import { LocalTicket } from '../lib/dbLocal';

export class TicketsRepository extends BaseRepository<LocalTicket> {
  constructor() {
    super('tickets');
  }

  async getByAsset(assetTag: string): Promise<LocalTicket[]> {
    return this.table.where('equipo_tag').equals(assetTag).toArray();
  }
}

export const ticketsRepo = new TicketsRepository();
