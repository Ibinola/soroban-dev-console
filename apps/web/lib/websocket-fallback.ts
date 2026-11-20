export class WebSocketFallback {
  private ws: WebSocket | null = null;
  constructor(private url: string, private onUpdate: (data: any) => void) {}
  connect() {
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onmessage = (e) => this.onUpdate(JSON.parse(e.data));
    } catch (e) {
      console.error("WS fallback connection failed", e);
    }
  }
  close() {
    this.ws?.close();
  }
}
