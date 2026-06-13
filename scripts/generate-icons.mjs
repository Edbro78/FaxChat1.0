import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assets = join(__dirname, '..', 'assets');
const ORANGE = '#E99311';

function buildSvg(size) {
  const faxSize = Math.round(size * 0.546);
  const chatSize = Math.round(faxSize * 0.5);
  const lineGap = Math.round(size * 0.02);
  const blockHeight = faxSize + lineGap + chatSize;
  const centerY = size / 2;
  const faxY = centerY - blockHeight / 2 + faxSize * 0.78;
  const chatY = faxY + lineGap + chatSize * 0.85;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <text x="50%" y="${faxY}" text-anchor="middle" fill="${ORANGE}" font-family="Impact, 'Arial Black', 'Franklin Gothic Medium', sans-serif" font-size="${faxSize}" font-weight="700" letter-spacing="-0.02em">FAX</text>
  <text x="50%" y="${chatY}" text-anchor="middle" fill="${ORANGE}" font-family="Impact, 'Arial Black', 'Franklin Gothic Medium', sans-serif" font-size="${chatSize}" font-weight="700" letter-spacing="0.01em">Chat</text>
</svg>`;
}

for (const size of [180, 192, 512]) {
  await sharp(Buffer.from(buildSvg(size)))
    .png()
    .toFile(join(assets, `icon-${size}.png`));
  console.log(`Wrote icon-${size}.png`);
}
