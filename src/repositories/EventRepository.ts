import { BaseRepository } from './BaseRepository';
import { LocalEvento } from '../db/database';

export class EventRepository extends BaseRepository<LocalEvento> {
  constructor() {
    super('events');
  }
}

export const eventRepo = new EventRepository();
