// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { server } from "./utilities/server.js";

// Mock `window.location` with Jest spies and extend expect
import "jest-location-mock";

// Make .env files accessible to tests (path relative to project root)
require("dotenv").config({ path: "./reactapp/__tests__/test.env" });
const originalError = console.error.bind(console.error);
const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
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
