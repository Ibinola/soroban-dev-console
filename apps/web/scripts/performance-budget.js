/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

// Load build stats
const manifestPath = path.join(__dirname, '../.next/build-manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error('Build manifest not found. Run npm run build first.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Define budgets (in KB)
const BUDGETS = {
  'pages/_app': 250,
  'pages/index': 200,
  'pages/contracts': 250,
  'pages/deploy': 200,
  'pages/tools': 200,
  'shared/chunks': 300,
};

let hasViolation = false;

console.log('\n📊 Performance Budget Check\n');
console.log('═'.repeat(50));

// Analyze main pages
for (const [key, budget] of Object.entries(BUDGETS)) {
  const files = manifest.pages[key] || [];
  const totalSize = files.reduce((sum, file) => {
    const filePath = path.join(__dirname, '../.next', file);
    if (fs.existsSync(filePath)) {
      return sum + fs.statSync(filePath).size;
    }
    return sum;
  }, 0);

  const sizeKB = Math.round(totalSize / 1024);
  const percentage = Math.round((sizeKB / budget) * 100);
  
  if (sizeKB > budget) {
    console.error(`❌ ${key}: ${sizeKB}KB / ${budget}KB (${percentage}%) - EXCEEDED`);
    hasViolation = true;
  } else if (percentage > 80) {
    console.warn(`⚠️  ${key}: ${sizeKB}KB / ${budget}KB (${percentage}%) - APPROACHING LIMIT`);
  } else {
    console.log(`✅ ${key}: ${sizeKB}KB / ${budget}KB (${percentage}%)`);
  }
}

// Check shared chunks
if (manifest.lowPriorityFiles) {
  const sharedSize = manifest.lowPriorityFiles.reduce((sum, file) => {
    if (file.includes('chunk') || file.includes('framework')) {
      const filePath = path.join(__dirname, '../.next', file);
      if (fs.existsSync(filePath)) {
        return sum + fs.statSync(filePath).size;
      }
    }
    return sum;
  }, 0);

  const sharedKB = Math.round(sharedSize / 1024);
  const sharedBudget = BUDGETS['shared/chunks'];
  const sharedPercentage = Math.round((sharedKB / sharedBudget) * 100);

  console.log('\n📦 Shared Chunks:');
  if (sharedKB > sharedBudget) {
    console.error(`❌ Shared chunks: ${sharedKB}KB / ${sharedBudget}KB (${sharedPercentage}%) - EXCEEDED`);
    hasViolation = true;
  } else {
    console.log(`✅ Shared chunks: ${sharedKB}KB / ${sharedBudget}KB (${sharedPercentage}%)`);
  }
}

console.log('\n' + '═'.repeat(50));

if (hasViolation) {
  console.error('\n❌ Performance budget check failed!\n');
  process.exit(1);
} else {
  console.log('\n✅ All performance budgets passed!\n');
  process.exit(0);
}
