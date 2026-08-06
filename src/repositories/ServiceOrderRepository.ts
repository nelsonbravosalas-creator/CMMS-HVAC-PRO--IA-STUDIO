import { BaseRepository } from './BaseRepository';
import type { LocalOrdenServicio } from '../db/database';

class ServiceOrderRepository extends BaseRepository<LocalOrdenServicio> {
  constructor() {
    super('ordenes_servicio');
  }
}

export const serviceOrdersRepo = new ServiceOrderRepository();

