import { chromium } from 'playwright';

async function captureGameScreenshot() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'log') {
      console.log(`[Browser] ${msg.text()}`);
    }
  });

  console.log('Navigating to game...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Wait for loading
  console.log('Waiting for game to load...');
  await page.waitForTimeout(5000);

  // Screenshot before click
  await page.screenshot({ path: 'screenshot-1-loading.png' });
  console.log('Screenshot 1: Loading screen');

  // Click to start and request pointer lock
  console.log('Clicking to start game...');
  await page.click('canvas');
  await page.waitForTimeout(1000);

  // Screenshot after click
  await page.screenshot({ path: 'screenshot-2-started.png' });
  console.log('Screenshot 2: Game started');

  // Simulate mouse movement to look around (even without pointer lock in headless)
  // Move camera by dispatching keyboard events
  console.log('Simulating player movement...');

  // Press W to move forward
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');

  await page.screenshot({ path: 'screenshot-3-moved.png' });
  console.log('Screenshot 3: After moving forward');

  // Move more and turn
  await page.keyboard.down('a');
  await page.waitForTimeout(300);
  await page.keyboard.up('a');

  await page.keyboard.down('w');
  await page.waitForTimeout(1000);
  await page.keyboard.up('w');

  await page.screenshot({ path: 'screenshot-4-explored.png' });
  console.log('Screenshot 4: After exploring');

  console.log('All screenshots saved!');
  await browser.close();
}

captureGameScreenshot().catch(console.error);
