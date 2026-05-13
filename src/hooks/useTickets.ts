import { useAppStore } from '../store/useAppStore';
import { ticketsRepo } from '../repositories/TicketsRepository';
import { LocalTicket } from '../db/database';

export const useTickets = () => {
  const addTicketToStore = useAppStore(state => state.addTicket);
  const updateTicketInStore = useAppStore(state => state.updateTicket);
  const deleteTicketFromStore = useAppStore(state => state.deleteTicket);

  const createTicket = async (data: Partial<LocalTicket>) => {
    const newTicket: LocalTicket = {
      ...data,
      uuid_sincro: crypto.randomUUID(),
      modificado_en: Date.now(),
      sync_status: 'pending_insert'
    } as LocalTicket;

    await ticketsRepo.save(newTicket);
    addTicketToStore(newTicket);
    return newTicket;
  };

  const updateTicket = async (uuid: string, updates: Partial<LocalTicket>) => {
    const existing = await ticketsRepo.getById(uuid);
    if (!existing) throw new Error('Ticket not found');

    const updated: LocalTicket = {
      ...existing,
      ...updates,
      modificado_en: Date.now(),
      sync_status: 'pending_update'
    };

    await ticketsRepo.save(updated);
    updateTicketInStore(updated);
    return updated;
  };

  const deleteTicket = async (uuid: string) => {
    await ticketsRepo.delete(uuid);
    deleteTicketFromStore(uuid);
  };

  return {
    createTicket,
    updateTicket,
    deleteTicket
  };
};
