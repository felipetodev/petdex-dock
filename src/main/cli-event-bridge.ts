import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { BrowserWindow } from 'electron';
import { CLI_EVENT_BRIDGE_HOST, CLI_EVENT_BRIDGE_PORT } from '../constants';
import type { CliEventSource, CliEventState, CliPetEvent } from '../shared/types';

const ALLOWED_SOURCES = new Set<CliEventSource>(['codex', 'claude', 'opencode', 'manual']);
const ALLOWED_STATES = new Set<CliEventState>(['running', 'waiting', 'failed', 'review', 'idle']);
const MAX_BODY_BYTES = 16 * 1024;

let server: Server | null = null;

type CliEventBridgeDependencies = {
  getPetWindow: () => BrowserWindow | null;
};

export function startCliEventBridge(dependencies: CliEventBridgeDependencies): void {
  if (server) return;

  server = createServer((request, response) => {
    void handleRequest(request, response, dependencies);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`CLI event bridge disabled: ${CLI_EVENT_BRIDGE_HOST}:${CLI_EVENT_BRIDGE_PORT} is already in use.`);
      server = null;
      return;
    }

    console.warn('CLI event bridge error:', error);
  });

  server.listen(CLI_EVENT_BRIDGE_PORT, CLI_EVENT_BRIDGE_HOST, () => {
    console.log(`CLI event bridge listening on http://${CLI_EVENT_BRIDGE_HOST}:${CLI_EVENT_BRIDGE_PORT}/event`);
  });
}

export function stopCliEventBridge(): void {
  if (!server) return;

  server.close();
  server = null;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: CliEventBridgeDependencies
): Promise<void> {
  if (request.url !== '/event') {
    console.log(`[cli-event] ignored ${request.method || 'UNKNOWN'} ${request.url || ''}: not found`);
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  if (request.method !== 'POST') {
    console.log(`[cli-event] ignored ${request.method || 'UNKNOWN'} /event: method not allowed`);
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const body = await readBody(request);
    console.log(`[cli-event] received raw payload: ${body}`);
    const event = parseCliEvent(body);

    console.log(`[cli-event] accepted source=${event.source} state=${event.state}${event.message ? ` message=${event.message}` : ''}`);
    dependencies.getPetWindow()?.webContents.send('cli-event', event);
    response.writeHead(204);
    response.end();
  } catch (error) {
    console.warn(`[cli-event] rejected payload: ${error instanceof Error ? error.message : 'Invalid request'}`);
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : 'Invalid request'
    });
  }
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;

      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

function parseCliEvent(body: string): CliPetEvent {
  let payload: unknown;

  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Payload must be a JSON object');
  }

  const source = (payload as { source?: unknown }).source;
  const state = (payload as { state?: unknown }).state;
  const message = (payload as { message?: unknown }).message;

  if (typeof source !== 'string' || !ALLOWED_SOURCES.has(source as CliEventSource)) {
    throw new Error('Invalid source');
  }

  if (typeof state !== 'string' || !ALLOWED_STATES.has(state as CliEventState)) {
    throw new Error('Invalid state');
  }

  if (message !== undefined && typeof message !== 'string') {
    throw new Error('Invalid message');
  }

  return {
    source: source as CliEventSource,
    state: state as CliEventState,
    ...(message ? { message } : {})
  };
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}
