import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/twilio/voice
 * Webhook endpoint for Twilio Voice calls
 */
router.post('/voice', (req: Request, res: Response) => {
  const callSid = req.body.CallSid || 'UNKNOWN';
  const from = req.body.From || 'UNKNOWN';
  const to = req.body.To || 'UNKNOWN';

  Logger.info(`Incoming Twilio Voice Call - Sid: ${callSid} - From: ${from} - To: ${to}`, 'TWILIO');

  // Build TwiML response to connect call to WebSocket stream
  const host = req.headers.host || 'localhost:5000';
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
  const streamUrl = `${protocol}://${host}/api/voice-stream?callerPhone=${encodeURIComponent(from)}&hospitalPhone=${encodeURIComponent(to)}`;

  Logger.info(`Routing Twilio Call to Stream URL: ${streamUrl}`, 'TWILIO');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you to AstraMind voice assistant. Please wait.</Say>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`;

  res.header('Content-Type', 'text/xml');
  res.status(200).send(twiml);
});

export default router;
