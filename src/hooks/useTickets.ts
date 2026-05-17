import { useAppStore } from '../store/useAppStore';
import { ticketsRepo } from '../repositories/WoRepository';
import { LocalTicket } from '../db/database';
import { syncEngine } from '../sync/syncEngine';

export const useTickets = () => {
  const addTicketToStore = useAppStore(state => state.addTicket);
  const updateTicketInStore = useAppStore(state => state.updateTicket);
  const deleteTicketFromStore = useAppStore(state => state.deleteTicket);

  const createTicket = async (data: Partial<LocalTicket>) => {
    const newTicket: LocalTicket = {
      ...data,
      uuid_sync: crypto.randomUUID(),
      updated_at: Date.now(),
      sync_status: 'pending_insert'
    } as LocalTicket;

    const savedTicket = await ticketsRepo.save(newTicket);
    addTicketToStore(savedTicket);
    syncEngine.triggerSync();
    return savedTicket;
  };

  const updateTicket = async (uuid: string, updates: Partial<LocalTicket>) => {
    const existing = await ticketsRepo.getById(uuid);
    if (!existing) throw new Error('Ticket not found');

    const updated: LocalTicket = {
      ...existing,
      ...updates
    };

    const savedTicket = await ticketsRepo.save(updated);
    updateTicketInStore(savedTicket);
    syncEngine.triggerSync();
    return savedTicket;
  };

  const deleteTicket = async (uuid: string) => {
    await ticketsRepo.delete(uuid);
    deleteTicketFromStore(uuid);
    syncEngine.triggerSync();
  };

  return {
    createTicket,
    updateTicket,
    deleteTicket
  };
};
