import { BaseRepository } from './BaseRepository';
import { LocalOrdenServicio } from '../db/database';

export class ServiceOrderRepository extends BaseRepository<LocalOrdenServicio> {
  constructor() {
    super('ordenes_servicio');
  }
}

export const serviceOrderRepo = new ServiceOrderRepository();
