/**
 * Placeholder for SmartAPI / market-data WebSocket streaming.
 * Phase: wire feed token, heartbeat, subscribe frames, and reconnect backoff.
 */
export type WsMessageHandler = (payload: unknown) => void;

export class WebSocketManager {
  private socket: WebSocket | null = null;
  private url: string | null = null;
  private onMessageHandler: WsMessageHandler | null = null;

  connect(url: string, _feedToken?: string) {
    this.url = url;
    // Intentionally no-op until streaming credentials + contract are finalized.
    if (this.socket) {
      this.disconnect();
    }
    this.socket = null;
  }

  onMessage(handler: WsMessageHandler) {
    this.onMessageHandler = handler;
  }

  send(_data: string | ArrayBuffer | Blob) {
    if (!this.socket) return;
    // this.socket.send(data);
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore
      }
    }
    this.socket = null;
    this.onMessageHandler = null;
    this.url = null;
  }

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

export const webSocketManager = new WebSocketManager();
