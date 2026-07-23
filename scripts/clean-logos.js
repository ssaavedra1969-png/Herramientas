const fs = require('fs');
const path = require('path');

const logosDir = path.join(__dirname, '..', 'public', 'img', 'logos');
const files = fs.readdirSync(logosDir).filter(f => f.endsWith('.svg'));

files.forEach(file => {
  const filePath = path.join(logosDir, file);
  let svg = fs.readFileSync(filePath, 'utf8');
  const original = svg;
  
  // Remove white background paths that cover the full viewBox
  // Pattern: <path fill="#fff" d="M0 0h{numbers}v{numbers}H0V0z"/>
  svg = svg.replace(/<path\s+fill="#fff"\s+d="M0\s+0h[\d.]+v[\d.]+H0V0z"\/>/g, '');
  
  // Pattern with fill-rule before fill
  svg = svg.replace(/<path\s+fill-rule="evenodd"\s+clip-rule="evenodd"\s+fill="#fff"\s+d="M0\s+0h[\d.]+v[\d.]+H0V0z"\/>/g, '');
  
  // Pattern: <path fill="#fff" ... d="M0 0h...v...H0V0z"/>  (more flexible)
  svg = svg.replace(/<path\s+[^>]*fill="#fff"[^>]*d="M0\s+0h[\d.]+v[\d.]+H0V0z"[^>]*\/>/g, '');
  
  // Pattern: rect with white fill
  svg = svg.replace(/<rect\s+[^>]*fill="#fff"[^>]*width="192[^"]*"[^>]*\/>/g, '');
  svg = svg.replace(/<rect\s+[^>]*width="192[^"]*"[^>]*fill="#fff"[^>]*\/>/g, '');
  
  // Clean up empty groups left behind
  svg = svg.replace(/<g\s+fill-rule="evenodd"\s+clip-rule="evenodd">\s*<\/g>/g, '');
  
  // Clean up multiple spaces
  svg = svg.replace(/\s{2,}/g, ' ');
  
  if (svg !== original) {
    fs.writeFileSync(filePath, svg, 'utf8');
    console.log(`Cleaned: ${file}`);
  } else {
    console.log(`Skipped (no white bg found): ${file}`);
  }
});

console.log(`\nDone! Processed ${files.length} SVG files.`);
