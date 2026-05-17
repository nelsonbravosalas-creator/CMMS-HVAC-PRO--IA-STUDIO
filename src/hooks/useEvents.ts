import { useAppStore } from '../store/useAppStore';
import { LocalEvento } from '../db/database';
import { eventRepo } from '../repositories/EventRepository';
import { syncEngine } from '../sync/syncEngine';

export const useEvents = () => {
  const events = useAppStore(state => state.events);
  const addEvent = useAppStore(state => state.addEvent);
  const updateEventInStore = useAppStore(state => state.updateEvent);
  const deleteEventFromStore = useAppStore(state => state.deleteEvent);

  const saveEvent = async (data: Partial<LocalEvento> & { id: string; data: any }) => {
    const saved = await eventRepo.save({
      ...data,
      uuid_sync: data.uuid_sync || data.id || crypto.randomUUID()
    } as LocalEvento);
    if (events.some(ev => ev.uuid_sync === saved.uuid_sync)) updateEventInStore(saved);
    else addEvent(saved);
    syncEngine.triggerSync();
    return saved;
  };

  const deleteEvent = async (uuid: string) => {
    await eventRepo.delete(uuid);
    deleteEventFromStore(uuid);
    syncEngine.triggerSync();
  };

  return { events, saveEvent, deleteEvent, syncNow: () => syncEngine.triggerSync() };
};
