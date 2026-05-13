import { BaseRepository } from './BaseRepository';
import { LocalUsuario } from '../db/database';

export class UserRepository extends BaseRepository<LocalUsuario> {
  constructor() {
    super('usuarios');
  }
  
  async getByEmail(email: string): Promise<LocalUsuario | undefined> {
    return this.table.where('email').equals(email).first();
  }
}

export const userRepo = new UserRepository();
