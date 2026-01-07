export class MockWebSocket {
  static instances = [];
  static reset() {
    MockWebSocket.instances = [];
    if (global.__wsInstances) global.__wsInstances = [];
  }
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
    MockWebSocket.instances.push(this);
    if (global.__wsInstances) global.__wsInstances.push(this); // <-- Add this line
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }
  send(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
  close() {
    this.readyState = 3; // CLOSED
    this.onclose && this.onclose();
  }
}
