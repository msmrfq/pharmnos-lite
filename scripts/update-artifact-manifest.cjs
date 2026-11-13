const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const manifestPath = 'prisma/financial-e2e-artifact-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

const newArtifacts = [
  { path: 'prisma/migrations/0029_product_batch_manufacture_date/migration.sql', classification: 'executable' },
  { path: 'prisma/migrations/0030_finalized_sales_immutability/migration.sql', classification: 'executable' },
  { path: 'prisma/migrations/0031_draft_invoice_partial_uniqueness/migration.sql', classification: 'executable' },
  { path: 'prisma/09-signed-context-tenant-isolation.sql', classification: 'executable' },
];

let nextOrder = manifest.artifacts.length + 1;
for (const artifact of newArtifacts) {
  const content = fs.readFileSync(artifact.path, 'utf8');
  manifest.artifacts.push({
    order: nextOrder++,
    path: artifact.path,
    sha256: sha256(content),
    classification: artifact.classification
  });
}

const [major, minor, patch] = manifest.packageVersion.split('.').map(Number);
manifest.packageVersion = `${major}.${minor}.${patch + 1}`;

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Manifest updated to version', manifest.packageVersion);
console.log('Total artifacts:', manifest.artifacts.length);