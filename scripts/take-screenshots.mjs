import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'docs', 'screenshots');
const baseUrl = 'http://localhost:5176';

const pages = [
  // Auth (taken before login)
  { path: '/login', name: '00-login', wait: 1500, noAuth: true },

  // Overview
  { path: '/', name: '01-command-center', wait: 2000 },

  // Capture
  { path: '/pcap', name: '02-pcap-analysis', wait: 1500 },
  { path: '/live-capture', name: '03-live-capture', wait: 1500 },
  { path: '/integrations', name: '04-external-tools', wait: 1500 },

  // Discovery
  { path: '/network', name: '05-network-topology', wait: 2500 },
  { path: '/assets', name: '06-device-inventory', wait: 1500 },
  { path: '/protocols', name: '07-protocol-analyzer', wait: 1500 },
  { path: '/purdue', name: '08-purdue-model', wait: 1500 },
  { path: '/signatures', name: '09-signature-editor', wait: 1500 },

  // Security & Detection
  { path: '/threats', name: '10-mitre-attack', wait: 1500 },
  { path: '/vulnerabilities', name: '11-vulnerability-management', wait: 1500 },
  { path: '/c2-detection', name: '12-c2-beacon-detection', wait: 1500 },
  { path: '/purdue-violations', name: '13-purdue-violations', wait: 1500 },
  { path: '/write-paths', name: '14-write-program-paths', wait: 1500 },
  { path: '/baseline', name: '15-baseline-drift', wait: 1500 },

  // Compliance
  { path: '/compliance', name: '16-compliance', wait: 1500 },

  // Analytics
  { path: '/scorecard', name: '17-security-scorecard', wait: 1500 },
  { path: '/metrics', name: '18-metrics', wait: 2000 },

  // Operations
  { path: '/sessions', name: '19-sessions-projects', wait: 1500 },

  // Investigations
  { path: '/investigations', name: '20-investigations', wait: 1500 },
  { path: '/report-diff', name: '21-report-diff', wait: 1500 },

  // Reporting
  { path: '/reports', name: '22-assessment-reports', wait: 1500 },
  { path: '/exports', name: '23-export-stix', wait: 1500 },

  // Administration
  { path: '/admin', name: '24-system-admin', wait: 1500 },

  // Vulnerability Intelligence
  { path: '/vuln-feed', name: '25-vuln-feed', wait: 1500 },
  { path: '/my-environment', name: '26-my-environment', wait: 1500 },

  // Additional
  { path: '/sbom', name: '27-sbom', wait: 1500 },
  { path: '/timeline', name: '28-timeline', wait: 1500 },
];

async function main() {
  await mkdir(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // ---- Step 1: Take login screenshot first ----
  console.log('📸 Capturing 00-login...');
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: join(outDir, '00-login.png'), fullPage: false });
  console.log('   ✅ Saved 00-login.png');

  // ---- Step 2: Set demo token in localStorage before clicking demo login ----
  await page.evaluate(() => {
    localStorage.setItem('gridwolf_token', 'demo-token');
  });

  // Click demo login button
  try {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.toLowerCase().includes('demo')) {
        await btn.click();
        await new Promise((r) => setTimeout(r, 2000));
        console.log('✅ Clicked demo login');
        break;
      }
    }
  } catch (e) {
    console.log('⚠️  No demo button found, proceeding anyway');
  }

  // Verify we're logged in
  const currentUrl = page.url();
  console.log(`📍 Current URL after login: ${currentUrl}`);

  let successCount = 1; // login already done
  let failCount = 0;

  // ---- Step 3: Navigate to each page using client-side routing ----
  for (const { path, name, wait, noAuth } of pages) {
    if (noAuth) continue; // login already captured

    console.log(`📸 Capturing ${name} (${path})...`);
    try {
      // Use client-side navigation to preserve auth state
      await page.evaluate((p) => {
        window.history.pushState({}, '', p);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, path);

      await new Promise((r) => setTimeout(r, wait));

      // Verify we're not redirected to login
      const pageUrl = page.url();
      if (pageUrl.includes('/login')) {
        console.log('   ⚠️  Redirected to login, re-authenticating...');
        await page.evaluate(() => {
          localStorage.setItem('gridwolf_token', 'demo-token');
        });
        // Click demo login again
        const buttons = await page.$$('button');
        for (const btn of buttons) {
          const text = await page.evaluate((el) => el.textContent, btn);
          if (text && text.toLowerCase().includes('demo')) {
            await btn.click();
            await new Promise((r) => setTimeout(r, 2000));
            break;
          }
        }
        // Navigate again
        await page.evaluate((p) => {
          window.history.pushState({}, '', p);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, path);
        await new Promise((r) => setTimeout(r, wait));
      }

      await page.screenshot({
        path: join(outDir, `${name}.png`),
        fullPage: false,
      });
      console.log(`   ✅ Saved ${name}.png`);
      successCount++;
    } catch (err) {
      console.error(`   ❌ Failed ${name}: ${err.message}`);
      failCount++;
    }
  }

  await browser.close();
  console.log(`\n🎉 Done! ${successCount} screenshots saved, ${failCount} failed.`);
  console.log(`📁 Location: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
