// Google Tasks integration is disabled — requires OAuth2 GCP client setup.
// TODO: Implement Google OAuth2 flow when GCP OAuth client is configured.

export function useGoogleTasks() {
  const syncTicketsToTasks = async (_tickets: any[]) => {
    return false;
  };

  return {
    syncTicketsToTasks,
    isSyncing: false,
    isAvailable: false,
    tasks: []
  };
}
