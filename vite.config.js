import { defineConfig } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function demoPage() {
  return {
    name: 'apk-release-pocket-demo-page',
    async closeBundle() {
      const output = resolve(import.meta.dirname, 'dist/site');
      const home = await readFile(resolve(output, 'index.html'), 'utf8');
      const demo = home
        .replace('<title>APK Release Pocket — verify and publish Android APKs</title>', '<title>Demo — APK Release Pocket</title>')
        .replace('href="https://apk-release-pocket.sociobot.in/">', 'href="https://apk-release-pocket.sociobot.in/demo/">')
        .replaceAll('content="APK Release Pocket — verify and publish Android APKs">', 'content="Demo — APK Release Pocket">')
        .replace('content="https://apk-release-pocket.sociobot.in/">', 'content="https://apk-release-pocket.sociobot.in/demo/">')
        .replace(/    <link rel="preload" href="\/assets\/hero-[^"]+\.webp" as="image" type="image\/webp" fetchpriority="high">\n/, '')
        .replace('<body>', '<body class="demo-mode">')
        .replace('id="demo-banner" aria-label="Demo controls" hidden', 'id="demo-banner" aria-label="Demo controls"')
        .replace(/        <div class="hero-art" aria-hidden="true">\n          <img[^>]+>\n        <\/div>\n/, '')
        .replace('Ship a verified APK release.', 'See a verified APK release.')
        .replace('For indie Android developers who need repeatable checks and clear install steps.', 'This bundled sample runs through the same signature check and release-page writer as your APK.');
      await mkdir(resolve(output, 'demo'), { recursive: true });
      await writeFile(resolve(output, 'demo/index.html'), demo);
    }
  };
}

export default defineConfig({
  root: 'site',
  publicDir: 'public',
  build: {
    outDir: '../dist/site',
    emptyOutDir: true,
    target: 'es2022',
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'site/index.html'),
        notFound: resolve(import.meta.dirname, 'site/404/index.html'),
        privacy: resolve(import.meta.dirname, 'site/privacy/index.html'),
        terms: resolve(import.meta.dirname, 'site/terms/index.html')
      }
    }
  },
  plugins: [demoPage()]
});
