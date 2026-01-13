// axe-scanner.js
// Run with: node axe-scanner.js
// Requires: npm install axe-core puppeteer

const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const fs = require('fs');

async function scanWebsite(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);
  
  const results = await new AxePuppeteer(page).analyze();
  await browser.close();
  
  return results;
}

function formatForGrafana(axeResults) {
  const timestamp = new Date().toISOString();
  
  // Summary metrics
  const summary = {
    timestamp: timestamp,
    url: axeResults.url,
    violations: axeResults.violations.length,
    passes: axeResults.passes.length,
    incomplete: axeResults.incomplete.length,
    inapplicable: axeResults.inapplicable.length,
    
    // Violations by severity
    critical: axeResults.violations.filter(v => v.impact === 'critical').length,
    serious: axeResults.violations.filter(v => v.impact === 'serious').length,
    moderate: axeResults.violations.filter(v => v.impact === 'moderate').length,
    minor: axeResults.violations.filter(v => v.impact === 'minor').length,
  };
  
  // Detailed violations
  const violations = axeResults.violations.map(violation => ({
    timestamp: timestamp,
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.length,
    tags: violation.tags.join(', ')
  }));
  
  return { summary, violations, fullResults: axeResults };
}

async function main() {
  const websiteUrl = process.argv[2] || 'https://example.com';
  
  console.log(`Scanning ${websiteUrl}...`);
  
  try {
    const results = await scanWebsite(websiteUrl);
    const formatted = formatForGrafana(results);
    
    // Save summary for time-series tracking
    const summaryFile = 'accessibility-summary.json';
    let summaryHistory = [];
    
    if (fs.existsSync(summaryFile)) {
      summaryHistory = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
    }
    
    summaryHistory.push(formatted.summary);
    fs.writeFileSync(summaryFile, JSON.stringify(summaryHistory, null, 2));
    
    // Save detailed violations
    fs.writeFileSync(
      `accessibility-violations-${Date.now()}.json`,
      JSON.stringify(formatted.violations, null, 2)
    );
    
    // Save full results for reference
    fs.writeFileSync(
      `accessibility-full-${Date.now()}.json`,
      JSON.stringify(formatted.fullResults, null, 2)
    );
    
    console.log('\n✅ Scan complete!');
    console.log(`Total violations: ${formatted.summary.violations}`);
    console.log(`  Critical: ${formatted.summary.critical}`);
    console.log(`  Serious: ${formatted.summary.serious}`);
    console.log(`  Moderate: ${formatted.summary.moderate}`);
    console.log(`  Minor: ${formatted.summary.minor}`);
    
  } catch (error) {
    console.error('Error scanning website:', error);
  }
}

main();
