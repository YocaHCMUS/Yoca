import '@testing-library/jest-dom/vitest';
import { Buffer } from 'buffer';
import { afterEach, beforeEach } from 'vitest';

globalThis.Buffer = Buffer;

let modalRoot: HTMLElement;
beforeEach(() => {
  modalRoot = document.createElement('div');
  modalRoot.id = 'modal-root';
  document.body.appendChild(modalRoot);
});
afterEach(() => {
  modalRoot.remove();
});
