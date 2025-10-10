#!/usr/bin/env node
/**
 * OG Image Generator for Necrography
 * Creates a 1200×630 Open Graph image from the sigil
 */

import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const SOURCE = './artifacts/sigil/AZ-VZ-01.png';
const OUTPUT_DIR = './og';
const WIDTH = 1200;
const HEIGHT = 630;

// Create og directory
await mkdir(OUTPUT_DIR, { recursive: true });

console.log('🖼️  Generating Open Graph image...\n');

try {
  // Create a dark background with the sigil centered and scaled appropriately
  const sigil = await sharp(SOURCE)
    .resize(400, 400, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toBuffer();

  // Create SVG with text overlay (using system fonts to avoid encoding issues)
  const svgOverlay = `
    <svg width="${WIDTH}" height="${HEIGHT}">
      <style>
        .title { 
          font-family: monospace; 
          font-size: 52px; 
          font-weight: 400;
          fill: #E6E3D8;
          letter-spacing: 0.5px;
        }
        .subtitle { 
          font-family: monospace; 
          font-size: 22px; 
          font-style: italic;
          fill: #a6a39a;
        }
      </style>
      <text x="600" y="480" text-anchor="middle" class="title">Vissarion Zounarakis</text>
      <text x="600" y="520" text-anchor="middle" class="subtitle">Barcelona-based software engineer</text>
    </svg>
  `;

  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 11, g: 11, b: 12, alpha: 1 } // --abyss
    }
  })
  .composite([
    {
      input: sigil,
      top: Math.floor((HEIGHT - 400) / 2) - 40, // Center vertically, shifted up a bit
      left: Math.floor((WIDTH - 400) / 2)
    },
    {
      input: Buffer.from(svgOverlay),
      top: 0,
      left: 0
    }
  ])
  .png()
  .toFile(join(OUTPUT_DIR, 'og-1200x630.png'));

  console.log(`✓ og-1200x630.png (${WIDTH}×${HEIGHT})`);
  console.log('\n✅ OG image generation complete!\n');
} catch (err) {
  console.error('✗ Failed to generate OG image:', err.message);
}
