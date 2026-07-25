import { LocalEvento } from '../db/database';
import { BaseRepository } from './BaseRepository';

export class EventRepository extends BaseRepository<LocalEvento> {
  constructor() {
    super('events');
  }
}

export const eventRepo = new EventRepository();
