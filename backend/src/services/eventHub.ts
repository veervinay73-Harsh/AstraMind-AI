import { WebSocket } from 'ws';

// Set of active dashboard client connections
export const dashboardClients = new Set<WebSocket>();

/**
 * Broadcast an event payload as JSON to all connected dashboard clients
 */
export const broadcastToDashboard = (event: any): void => {
  const payload = JSON.stringify(event);
  for (const client of dashboardClients) {
    if (client.readyState === 1 /* OPEN */) {
      try {
        client.send(payload);
      } catch (err) {
        console.error('Failed to send message to dashboard client', err);
      }
    }
  }
};
