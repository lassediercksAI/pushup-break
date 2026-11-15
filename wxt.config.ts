import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifest: ({ browser }) => ({
    name: 'Pushup Break',
    description:
      'Pauses YouTube after a set amount of watch time and asks for a short bodyweight exercise before the video resumes.',
    permissions: ['storage'],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    action: {
      default_title: 'Pushup Break',
    },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // A fixed ID keeps settings across reloads and allows signing later.
          id: 'pushup-break@lassediercksai.github.io',
          // Nothing leaves the browser.
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
