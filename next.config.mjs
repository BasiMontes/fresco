import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this repo — a stray lockfile one level up
  // (/Users/basimontes/fresco/package-lock.json, outside this project) would
  // otherwise make Next.js/Turbopack infer the wrong root.
  turbopack: {
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
};

export default nextConfig;
