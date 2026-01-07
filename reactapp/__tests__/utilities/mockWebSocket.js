export class MockWebSocket {
  static instances = [];
  static reset() {
    MockWebSocket.instances = [];
  }
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }
  send(data) {
    // Optionally, simulate a response:
    // setTimeout(() => this.onmessage && this.onmessage({ data: '{"requestId":"123","message":"test"}' }), 10);
  }
  close() {
    this.readyState = 3; // CLOSED
    this.onclose && this.onclose();
  }
}
