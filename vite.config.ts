import { defineConfig } from 'vite';
// /v1 is proxied to the cloud tier (server/vlm_server.py, or llm-gateway later).
export default defineConfig({ server: { proxy: { '/v1': process.env.CLOUD_TARGET || 'http://127.0.0.1:8095' } } });
