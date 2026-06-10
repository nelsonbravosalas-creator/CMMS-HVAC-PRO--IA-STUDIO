import { BaseRepository } from './BaseRepository';
import { LocalTicket } from '../db/database';

export class TicketsRepository extends BaseRepository<LocalTicket> {
  constructor() {
    super('work_orders');
  }

  async getByAsset(assetTag: string): Promise<LocalTicket[]> {
    return this.table.where('equipo_tag').equals(assetTag).toArray();
  }
}

export const ticketsRepo = new TicketsRepository();
