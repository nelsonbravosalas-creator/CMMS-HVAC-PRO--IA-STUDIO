import { useState, useCallback } from 'react';
import { getAccessToken, googleSignIn } from '../lib/auth';

export function useGoogleTasks() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);

  const ensureToken = async () => {
    let token = await getAccessToken();
    if (!token) {
      const result = await googleSignIn();
      if (result) {
         token = result.accessToken;
      }
    }
    if (!token) throw new Error("No Google token available. Please sign in.");
    return token;
  };

  const syncTicketsToTasks = async (tickets: any[]) => {
    setIsSyncing(true);
    try {
      const token = await ensureToken();
      
      // 1. Get task lists
      const listsRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const listsData = await listsRes.json();
      
      let listId = listsData.items?.find((l: any) => l.title === 'CMMS Tickets')?.id;
      
      // 2. Create list if it doesn't exist
      if (!listId) {
        const createListRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title: 'CMMS Tickets' })
        });
        const newList = await createListRes.json();
        listId = newList.id;
      }

      // 3. Get existing tasks
      const tasksRes = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const tasksData = await tasksRes.json();
      const existingTasks = tasksData.items || [];
      
      // 4. Sync each ticket
      for (const ticket of tickets) {
        if (ticket.estado === 'cerrado' || ticket.estado === 'cancelado') continue;
        
        const taskTitle = `[${ticket.id}] ${ticket.titulo}`;
        const existingTask = existingTasks.find((t: any) => t.title === taskTitle);
        
        if (!existingTask) {
           await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
            method: 'POST',
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              title: taskTitle,
              notes: `${ticket.equipo_tag ? 'Equipo: ' + ticket.equipo_tag + '\n' : ''}${ticket.descripcion || ''}\n\nPrioridad: ${ticket.prioridad}\nEstado: ${ticket.estado}`
            })
          });
        }
      }
      
      setTasks(existingTasks);
      return true;
    } catch (err) {
      console.error("Error syncing to Google Tasks", err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    syncTicketsToTasks,
    isSyncing,
    tasks
  };
}
