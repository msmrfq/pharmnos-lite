const fs = require('fs');
const path = 'E:/PharmnosLite/src/app/reports/stock-valuation/page.tsx';
const content = fs.readFileSync(path, 'utf8');
const fixed = content.replace('show "Pending" and are excluded from value totals.', 'show "Pending" and are excluded from value totals.');
fs.writeFileSync(path, fixed, 'utf8');
console.log('Fixed');