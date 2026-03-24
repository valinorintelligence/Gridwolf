import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'screenshots');
const baseUrl = 'http://localhost:5174';

const pages = [
  { path: '/', name: 'command-center', wait: 2000 },
  { path: '/protocols', name: 'protocol-analyzer', wait: 1500 },
  { path: '/purdue', name: 'purdue-model', wait: 1500 },
  { path: '/vulnerabilities', name: 'vulnerability-management', wait: 1500 },
  { path: '/threats', name: 'threat-intelligence', wait: 1500 },
  { path: '/graph', name: 'relationship-graph', wait: 2500 },
  { path: '/network', name: 'network-topology', wait: 1500 },
  { path: '/attack-paths', name: 'attack-paths', wait: 1500 },
  { path: '/compliance', name: 'compliance', wait: 1500 },
  { path: '/scorecard', name: 'security-scorecard', wait: 1500 },
  { path: '/ontology', name: 'ontology-explorer', wait: 1500 },
  { path: '/copilot', name: 'ai-copilot', wait: 1500 },
];

async function main() {
  await mkdir(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox'],
  });

  const page = await browser.newPage();

  for (const { path, name, wait } of pages) {
    const url = `${baseUrl}${path}`;
    console.log(`📸 Capturing ${name} (${url})...`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise((r) => setTimeout(r, wait));
    await page.screenshot({
      path: join(outDir, `${name}.png`),
      fullPage: false,
    });
    console.log(`   ✅ Saved ${name}.png`);
  }

  await browser.close();
  console.log(`\n🎉 All ${pages.length} screenshots saved to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
