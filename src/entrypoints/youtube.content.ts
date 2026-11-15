import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  main() {
    // Wired up in a later milestone.
  },
});
