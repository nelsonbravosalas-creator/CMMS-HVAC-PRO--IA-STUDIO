import { getAccessToken } from './auth';
import type { LocalTicket } from '../db/database';

export const syncTicketToGoogleTasks = async (ticket: LocalTicket) => {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.warn('No Google access token found, skipping task sync.');
    return;
  }

  try {
    // 1. Get the Task list specifically for CMMS
    let taskListId = await getTasklistId(accessToken);
    if (!taskListId) {
      taskListId = await createTaskList(accessToken);
    }

    // 2. See if the task already exists
    // We store the ticket ID in the task notes to find it later.
    const existingTaskId = await findTaskForTicket(accessToken, taskListId, ticket.id);

    const taskData = {
      title: `[${ticket.prioridad.toUpperCase()}] Ticket ${ticket.id}: ${ticket.titulo}`,
      notes: `Ticket ID: ${ticket.id}\nEquipo: ${ticket.equipo_tag || 'N/A'}\nEstado: ${ticket.estado}\n\n${ticket.descripcion || ''}`,
      status: ticket.estado === 'cerrado' || ticket.estado === 'cancelado' ? 'completed' : 'needsAction',
      due: new Date(ticket.fecha_creacion).toISOString() // Optional: add due date if we have one
    };

    if (existingTaskId) {
      // Update existing
      await updateTask(accessToken, taskListId, existingTaskId, taskData);
    } else {
      // Create new
      await createTask(accessToken, taskListId, taskData);
    }
  } catch (error) {
    console.error('Failed to sync ticket to Google Tasks', error);
  }
};

const getTasklistId = async (token: string): Promise<string | null> => {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const list = data.items?.find((l: any) => l.title === 'CMMS Tickets');
  return list ? list.id : null;
};

const createTaskList = async (token: string): Promise<string> => {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: 'CMMS Tickets' })
  });
  const data = await res.json();
  return data.id;
};

const findTaskForTicket = async (token: string, listId: string, ticketId: string): Promise<string | null> => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  const task = data.items?.find((t: any) => t.notes && t.notes.includes(`Ticket ID: ${ticketId}`));
  return task ? task.id : null;
};

const createTask = async (token: string, listId: string, taskData: any) => {
  await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(taskData)
  });
};

const updateTask = async (token: string, listId: string, taskId: string, taskData: any) => {
  await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ...taskData, id: taskId })
  });
};
