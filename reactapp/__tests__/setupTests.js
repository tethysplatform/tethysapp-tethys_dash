// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { server } from "./utilities/server.js";

// Mock `window.location` with Jest spies and extend expect
import "jest-location-mock";
import { createMocks } from "react-idle-timer";

// Make .env files accessible to tests (path relative to project root)
const originalError = console.error.bind(console.error);
const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  global.__wsInstances = [];
});

// Setup mocked Tethys API
beforeAll(() => {
  server.listen();
  console.error = (...args) => {
    if (
      !args
        .toString()
        .includes(
          "Warning: `ReactDOMTestUtils.act` is deprecated in favor of `React.act`. Import `act` from `react` instead of `react-dom/test-utils`."
        ) &&
      !args.toString().includes("act(...)")
    ) {
      originalError(...args);
    }
  };
  createMocks();
});
// if you need to add a handler after calling setupServer for some specific test
// this will remove that handler for the rest of them
// (which is important for test isolation):
afterEach(() => {
  cleanup();
  server.resetHandlers();
  process.env = originalEnv;
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

afterAll(() => {
  server.close();
  console.error = originalError;
  cleanup();
});

// Mocks for tests involving plotly
window.URL.createObjectURL = jest.fn();
HTMLCanvasElement.prototype.getContext = function () {
  return {
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    clip: () => {},
  };
};

global.__wsInstances = []; // Track all instances

class WebSocketMock {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.send = jest.fn();
    this.close = jest.fn(() => {
      if (this.onclose) this.onclose();
    });
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
    global.__wsInstances.push(this);
  }
  mockMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }
}

global.WebSocket = WebSocketMock;
