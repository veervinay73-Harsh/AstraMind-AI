/// <reference path="./types/express.d.ts" />
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer } from 'ws';

// Import custom configurations and utilities
import { validateEnv } from './middlewares/envValidator';
import { Logger } from './utils/logger';

// Import middlewares
import { requestIdMiddleware } from './middlewares/requestId';
import { correlationIdMiddleware } from './middlewares/correlationId';
import { requestTimingMiddleware } from './middlewares/requestTiming';
import { securityHeadersMiddleware } from './middlewares/securityHeaders';
import { rateLimiterMiddleware } from './middlewares/rateLimiter';
import { loggerMiddleware } from './middlewares/loggerHandler';
import { healthCheckMiddleware } from './middlewares/healthCheck';
import { maintenanceModeMiddleware } from './middlewares/maintenanceMode';
import { apiVersionMiddleware } from './middlewares/apiVersion';
import { notFoundMiddleware } from './middlewares/notFound';
import { errorHandlerMiddleware } from './middlewares/errorHandler';

// Import routers
import livekitRouter from './routes/livekit.routes';

// Import voice session handler (browser-based, replaces Twilio WebSocket handler)
import { handleSession } from './services/sessionHandler';

// Load environment variables
dotenv.config();

// Validate environment variables on startup
validateEnv();

const app = express();
const PORT = process.env.PORT || 5000;

// Setup Process Exception Listeners to prevent silent crashes
process.on('uncaughtException', (err: Error) => {
  Logger.error('CRITICAL: Uncaught Exception!', err, 'SYSTEM');
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  Logger.error(`CRITICAL: Unhandled Rejection! Reason: ${String(reason)}`, undefined, 'SYSTEM');
  process.exit(1);
});

// 1. Trace ID / Audit Middlewares
app.use(requestIdMiddleware);
app.use(correlationIdMiddleware);
app.use(requestTimingMiddleware);

// 2. Security Headers (Helmet + Custom Security Middleware)
app.use(helmet());
app.use(securityHeadersMiddleware);

// 3. CORS configuration
app.use(cors());

// 4. Request Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Intercept routes before rate limit/logging checks
app.use(healthCheckMiddleware);

// 6. Access Control & Filtering
app.use(maintenanceModeMiddleware);
app.use(rateLimiterMiddleware(60 * 1000, 100)); // Limit: 100 req/min
app.use(apiVersionMiddleware('v1'));

// 7. Request logging (logs only filtered API requests)
app.use(loggerMiddleware);

import appointmentRouter from './routes/appointment.routes';
import doctorRouter from './routes/doctor.routes';
import patientRouter from './routes/patient.routes';
import kbRouter from './routes/kb.routes';
import analyticsRouter from './routes/analytics.routes';
import settingsRouter from './routes/settings.routes';

// 8. Register Routers
app.use('/api/livekit', livekitRouter);       // LiveKit token generation & status
app.use('/api/appointments', appointmentRouter);
app.use('/api/doctors', doctorRouter);
app.use('/api/patients', patientRouter);
app.use('/api/kb', kbRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/settings', settingsRouter);

// 9. Post-routing fallbacks and error captures
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// Create HTTP Server wrapping the Express app
const server = http.createServer(app);

import { dashboardClients } from './services/eventHub';

// Initialize WebSocket Servers
const wssSession = new WebSocketServer({ noServer: true });    // Browser voice sessions
const wssDashboard = new WebSocketServer({ noServer: true });  // Live dashboard clients

// Handle upgrade requests
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

  if (pathname === '/api/session') {
    // Browser voice session (replaces /api/voice-stream)
    wssSession.handleUpgrade(request, socket, head, (ws) => {
      wssSession.emit('connection', ws, request);
    });
  } else if (pathname === '/api/dashboard') {
    // Live calls dashboard WebSocket
    wssDashboard.handleUpgrade(request, socket, head, (ws) => {
      wssDashboard.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Bind WebSocket connection listeners
wssSession.on('connection', (ws, request) => {
  handleSession(ws, request);
});

wssDashboard.on('connection', (ws) => {
  dashboardClients.add(ws);
  Logger.info('Dashboard WebSocket client connected.', 'DASHBOARD');

  ws.on('close', () => {
    dashboardClients.delete(ws);
    Logger.info('Dashboard WebSocket client disconnected.', 'DASHBOARD');
  });

  ws.on('error', (err) => {
    Logger.error('Dashboard WebSocket error', err, 'DASHBOARD');
    dashboardClients.delete(ws);
  });
});

// Start listening for requests
server.listen(PORT, () => {
  Logger.info(`🚀 AstraMind AI Backend running on http://localhost:${PORT}`, 'STARTUP');
  Logger.info(`📡 Voice Session WebSocket: ws://localhost:${PORT}/api/session`, 'STARTUP');
  Logger.info(`📊 Dashboard WebSocket:     ws://localhost:${PORT}/api/dashboard`, 'STARTUP');
  Logger.info(`🎙️  LiveKit Token API:      POST http://localhost:${PORT}/api/livekit/token`, 'STARTUP');
});

