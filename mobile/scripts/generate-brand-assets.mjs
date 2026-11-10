import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { angkorWatPaths } from '../../lib/business-card-art.ts';

const require = createRequire(new URL('../../package.json', import.meta.url));
const sharp = require('sharp');
const output = name => fileURLToPath(new URL(`../assets/images/${name}`, import.meta.url));
const mark = fileURLToPath(new URL('../../public/icons/saiway-mark.svg', import.meta.url));
const landscape = fileURLToPath(new URL('../../public/backgrounds/siem-reap.svg', import.meta.url));
const temples = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="680" viewBox="0 0 320 170">
  <circle cx="252" cy="54" r="42" fill="#dfb56b" opacity=".6"/>
  <g fill="#032ea1">${angkorWatPaths.map(d => `<path d="${d}"/>`).join('')}</g>
  <path d="M0 161 Q80 153 160 161 T320 161" fill="none" stroke="#dfb56b" stroke-width="3"/>
</svg>`;

await Promise.all([
  sharp(mark).resize(160, 160).png().toFile(output('saiway-mark.png')),
  sharp(mark).resize(1024, 1024).png().toFile(output('saiway-icon.png')),
  sharp(landscape).png().toFile(output('angkor-landscape.png')),
  sharp(Buffer.from(temples)).png().toFile(output('angkor-temples.png')),
]);
console.log('SAIWAY mobile assets regenerated from the existing web brand.');
