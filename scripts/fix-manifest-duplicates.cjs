const fs = require('fs');
const crypto = require('crypto');

const manifestPath = 'prisma/financial-e2e-artifact-manifest.json';
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Remove duplicates by path
const seen = new Set();
const uniqueArtifacts = [];
for (const artifact of manifest.artifacts) {
  if (!seen.has(artifact.path)) {
    seen.add(artifact.path);
    uniqueArtifacts.push(artifact);
  }
}

// Renumber orders
uniqueArtifacts.forEach((artifact, index) => {
  artifact.order = index + 1;
});

manifest.artifacts = uniqueArtifacts;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('Removed duplicates. Total artifacts:', manifest.artifacts.length);