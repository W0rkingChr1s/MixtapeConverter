#!/usr/bin/env node
/**
 * check-links.js
 * Scans all *.html files and checks that every internal href / src
 * (files that are not http(s) URLs) actually exists on disk.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const htmlFiles = readdirSync(ROOT).filter(f => f.endsWith('.html'));

// Simple regex-based extraction – good enough for our flat structure
const REF_RE = /(?:href|src)="([^"]+)"/g;

let errors = 0;

for (const file of htmlFiles) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  let match;
  while ((match = REF_RE.exec(content)) !== null) {
    const ref = match[1];
    // Skip external URLs, anchors, mailto, and template literals
    if (/^(https?:|mailto:|#|\$\{)/.test(ref)) continue;

    const target = resolve(ROOT, ref.split('?')[0].split('#')[0]);
    if (!existsSync(target)) {
      console.error(`✗  ${file}: broken reference → ${ref}`);
      errors++;
    }
  }
}

if (errors === 0) {
  console.log(`✓  All internal links OK (${htmlFiles.length} files checked)`);
  process.exit(0);
} else {
  console.error(`\n${errors} broken link(s) found.`);
  process.exit(1);
}
