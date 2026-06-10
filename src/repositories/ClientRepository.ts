import { BaseRepository } from './BaseRepository';
import { LocalCliente } from '../db/database';

export class ClientRepository extends BaseRepository<LocalCliente> {
  constructor() {
    super('clientes');
  }
}

export const clientRepo = new ClientRepository();
