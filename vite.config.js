import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  // Support the existing Firebase project settings as well as standard Vite names.
  const aliases = {
    VITE_FIREBASE_API_KEY: 'apiKey',
    VITE_FIREBASE_PROJECT_ID: 'projectId',
    VITE_FIREBASE_AUTH_DOMAIN: 'authDomain',
    VITE_FIREBASE_APP_ID: 'appId',
    VITE_FIREBASE_STORAGE_BUCKET: 'storageBucket',
    VITE_FIREBASE_MESSAGING_SENDER_ID: 'messagingSenderId',
  };
  const define = Object.fromEntries(Object.entries(aliases).map(([name, alias]) => [
    `import.meta.env.${name}`, JSON.stringify(environment[name] || environment[alias] || ''),
  ]));
  return {
    plugins: [react()], define,
    server: {
      headers: {
        // Vite injects an inline refresh preamble in development only.
        'Content-Security-Policy': "script-src 'self' 'unsafe-inline'; connect-src 'self' ws: https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src https://*.firebaseapp.com https://*.web.app",
      },
    },
  };
})
