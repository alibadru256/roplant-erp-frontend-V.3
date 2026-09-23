import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // Vite inlines import.meta.env.VITE_API_URL at build time. If it's missing during a
  // production build, the deployed bundle would silently fall back to localhost — which
  // works on your machine and fails for every real user. Fail loudly instead.
  if (command === 'build' && mode === 'production' && !process.env.VITE_API_URL) {
    throw new Error(
      'VITE_API_URL is not set. Set it to your deployed backend URL before building for production, e.g.:\n' +
      '  VITE_API_URL=https://your-backend.example.com/api npm run build'
    );
  }
  return {
    plugins: [react()],
    server: { port: 5173 },
  };
});
