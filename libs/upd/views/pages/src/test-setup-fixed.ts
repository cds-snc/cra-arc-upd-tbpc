// Fix for ReadableStream not defined error
(global as any).ReadableStream = jest.fn().mockImplementation(() => ({
  cancel: jest.fn(),
  locked: false,
  getReader: jest.fn()
}));

// Use the new setup method
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
setupZoneTestEnv();

// Add any other global test configuration here
Object.defineProperty(window, 'CSS', {value: null});
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    display: 'none',
    appearance: ['-webkit-appearance']
  })
});

Object.defineProperty(document, 'doctype', {
  value: '<!DOCTYPE html>'
});

Object.defineProperty(document.body.style, 'transform', {
  value: () => {
    return {
      enumerable: true,
      configurable: true
    };
  }
});