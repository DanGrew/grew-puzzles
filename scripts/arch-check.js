#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { extractInlineScripts } = require('./html-utils');

const rule = process.argv[2];
const outputFile = process.argv[3];

if (require.main === module && (!rule || !outputFile)) {
  console.error("Usage: node arch-check.js <rule> <outputFile>");
  process.exit(1);
}

const ROOT = process.cwd();

function getAllFiles(dir, ext = ['.js']) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(full, ext));
    } else if (ext.includes(path.extname(full))) {
      results.push(full);
    }
  });
  return results;
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}


function findMatches(content, regex) {
  const re = new RegExp(regex.source, 'g');
  const results = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    const line = content.slice(0, m.index).split('\n').length;
    results.push({ line, text: m[0].slice(0, 60).replace(/\s+/g, ' ') });
  }
  return results;
}

const DOM_PATTERN = /\b(document|window|navigator|location|requestAnimationFrame|cancelAnimationFrame|fetch|decodeAudioBuffer|decodeAudioData)\b|\.(?:style\b|classList\b|textContent\b|innerHTML\b|innerText\b|appendChild\b|removeChild\b|remove\b|insertBefore\b|addEventListener\b|removeEventListener\b|setAttribute\b|getAttribute\b|querySelector\b|querySelectorAll\b|getElementById\b|offsetTop\b|offsetLeft\b|offsetWidth\b|offsetHeight\b|clientHeight\b|clientWidth\b|scrollTo\b|scrollLeft\b|scrollTop\b|cssText\b|createElementNS\b|createBufferSource\b|createGain\b|resume\b|decodeAudioData\b|clearRect\b|fillRect\b|strokeRect\b|drawImage\b|beginPath\b|moveTo\b|lineTo\b|arc\b|fill\b|stroke\b|fillText\b|strokeText\b|getImageData\b|putImageData\b|createLinearGradient\b|createRadialGradient\b)/;

function hasTopLevelReturn(body) {
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '{') { depth++; continue; }
    if (body[i] === '}') { depth--; continue; }
    if (depth === 0 && /^return\b/.test(body.slice(i))) return true;
  }
  return false;
}

function matchDelimiter(s, open, openCh, closeCh) {
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    if (s[k] === openCh) depth++;
    else if (s[k] === closeCh) { depth--; if (depth === 0) return k; }
  }
  return -1;
}

// Given the index just after a transform method's '(', return the block-body of an
// inline callback (function(){…} or (…)=>{…}), or null if the argument is not a
// block-body callback (named-fn reference, expression-body arrow, etc.).
function extractBlockCallbackBody(s, i) {
  while (i < s.length && /\s/.test(s[i])) i++;
  let braceStart = -1;
  if (s.startsWith('function', i)) {
    const paren = s.indexOf('(', i);
    if (paren === -1) return null;
    const closeParen = matchDelimiter(s, paren, '(', ')');
    if (closeParen === -1) return null;
    let j = closeParen + 1;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] !== '{') return null;
    braceStart = j;
  } else {
    let j = i;
    if (s[j] === '(') {
      const close = matchDelimiter(s, j, '(', ')');
      if (close === -1) return null;
      j = close + 1;
    } else if (/[A-Za-z_$]/.test(s[j])) {
      while (j < s.length && /[\w$]/.test(s[j])) j++;
    } else {
      return null;
    }
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] !== '=' || s[j + 1] !== '>') return null;
    j += 2;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] !== '{') return null; // expression-body arrow — out of scope
    braceStart = j;
  }
  const end = matchDelimiter(s, braceStart, '{', '}');
  if (end === -1) return null;
  return s.slice(braceStart + 1, end);
}

// Flags block-body callbacks passed to array-transform methods that hold pure
// logic (top-level return or a computation token) and touch no DOM — the
// untestable-by-vitest gap no-pure-fn-outside-core misses (named fns only).
function detectInlineCallbackViolations(script) {
  const METHOD_RE = /\.(map|filter|reduce|reduceRight|flatMap|sort|find|findIndex|some|every)\s*\(/g;
  const COMPUTATION_PATTERN = /\bMath\.\w+|\bparseInt\b|\bparseFloat\b|[-+*/%]|[<>]=?|[=!]==/;
  const results = [];
  let m;
  while ((m = METHOD_RE.exec(script)) !== null) {
    const openParen = m.index + m[0].length - 1;
    const body = extractBlockCallbackBody(script, openParen + 1);
    if (body === null) continue;
    if (DOM_PATTERN.test(body)) continue;
    if (!hasTopLevelReturn(body) && !COMPUTATION_PATTERN.test(body)) continue;
    const line = script.slice(0, m.index).split('\n').length;
    results.push({ line, method: m[1] });
  }
  return results;
}

let violations = [];
let scanned = [];

if (rule === 'no-dom-in-core') {
  const files = getAllFiles(path.join(ROOT, 'core'));
  files.forEach(file => {
    const content = read(file);
    scanned.push(file);
    if (/\bdocument\b/.test(content) || /\bwindow\b/.test(content)) {
      violations.push(`${file} uses DOM globals`);
    }
  });
}

if (rule === 'no-ui-imports') {
  const files = getAllFiles(path.join(ROOT, 'core'));
  files.forEach(file => {
    const content = read(file);
    scanned.push(file);
    if (content.match(/from ['"].*\/ui\//)) {
      violations.push(`${file} imports from /ui`);
    }
  });
}

if (rule === 'no-stray-files') {
  const EXCLUDED = new Set(['scripts', 'tests', '.github', 'node_modules', 'coverage', 'reports', '.claude', 'assets', 'content']);
  const LAYERS = new Set(['core', 'ui', 'app', 'components', 'styles']);
  const allFiles = getAllFiles(ROOT);
  allFiles.forEach(file => {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    const parts = rel.split('/');
    if (parts.length === 1) return; // root-level config files (vitest.config.js etc.)
    const topDir = parts[0];
    if (EXCLUDED.has(topDir)) return;
    scanned.push(file);
    if (!LAYERS.has(topDir)) {
      violations.push(`${rel} is outside a recognised layer (core/ui/app/components/styles)`);
    }
  });
}

if (rule === 'no-guard-chain') {
  const CHAIN_LINE = /('true'\s*:\s*\(\)\s*=>\s*\w+\[).*('false'\s*:\s*\(\)\s*=>\s*\{\s*\})/;
  const WINDOW = 10;

  function checkGuardChain(lines, label) {
    for (let i = 0; i < lines.length; i++) {
      if (!CHAIN_LINE.test(lines[i])) continue;
      const chainLines = [i];
      for (let j = i + 1; j < Math.min(i + WINDOW, lines.length); j++) {
        if (CHAIN_LINE.test(lines[j])) chainLines.push(j);
      }
      if (chainLines.length >= 2) {
        violations.push(`${label} — chained noop-guard dispatch tables at lines ${chainLines.map(l => l + 1).join(', ')} (use [fn].filter(() => [...].every(Boolean)).forEach(f => f()))`);
        break;
      }
    }
  }

  getAllFiles(path.join(ROOT, 'ui'), ['.js']).forEach(file => {
    const content = read(file);
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    scanned.push(rel);
    checkGuardChain(content.split('\n'), rel);
  });

  getAllFiles(path.join(ROOT, 'app'), ['.html']).forEach(file => {
    const html = read(file);
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    extractInlineScripts(html).forEach((script, blockIdx) => {
      const label = `${rel} (block ${blockIdx + 1})`;
      scanned.push(label);
      checkGuardChain(script.split('\n'), label);
    });
  });
}

if (rule === 'no-app-exports') {
  const files = getAllFiles(path.join(ROOT, 'app'));
  files.forEach(file => {
    const content = read(file);
    scanned.push(file);
    if (/^export\s/m.test(content)) {
      violations.push(`${path.relative(ROOT, file).replace(/\\/g, '/')} exports from app/ (move to core/ or ui/)`);
    }
  });
}

if (rule === 'no-filter-conditional') {
  // [null] or [undefined] used as a conditional sentinel (use boolean dispatch table instead)
  const NULL_SENTINEL = /\[\s*(null|undefined)\s*\]\s*\.filter\s*\(/;
  // negation filter where the callback negates its OWN parameter — the "else" side of an if/else
  // backreference \1 ensures we only catch: function(x){return !x  not: function(){return !outerVar
  const NEGATION_FILTER = /\[[^\[\],\n]{1,80}\]\s*\.filter\s*\(\s*function\s*\((\w+)\)\s*\{[^{}]{0,60}return\s*!\1\b/;

  function checkContent(content, label) {
    findMatches(content, NULL_SENTINEL).forEach(({ line, text }) => {
      violations.push(`${label} — null/undefined sentinel as conditional at line ${line}: \`${text}\` (use boolean dispatch table)`);
    });
    findMatches(content, NEGATION_FILTER).forEach(({ line, text }) => {
      violations.push(`${label} — negation filter on single-element array at line ${line}: \`${text}\` (use boolean dispatch table)`);
    });
  }

  getAllFiles(path.join(ROOT, 'ui'), ['.js']).forEach(file => {
    const content = read(file);
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    scanned.push(rel);
    checkContent(content, rel);
  });

  getAllFiles(path.join(ROOT, 'app'), ['.html']).forEach(file => {
    const html = read(file);
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    extractInlineScripts(html).forEach((script, i) => {
      scanned.push(rel + ' (block ' + (i + 1) + ')');
      checkContent(script, rel);
    });
  });
}

if (rule === 'app-index-only') {
  const appDir = path.join(ROOT, 'app');
  function walkApp(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(entry => {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) { walkApp(full); return; }
      const rel = path.relative(ROOT, full).replace(/\\/g, '/');
      scanned.push(rel);
      if (path.extname(full).toLowerCase() !== '.html') {
        violations.push(`${rel} — app/ must contain only HTML pages (no JS/CSS/media)`);
      }
    });
  }
  walkApp(appDir);
}

if (rule === 'no-media-outside-assets') {
  const MEDIA_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp3', '.mp4', '.wav', '.ogg']);
  const EXCLUDED = new Set(['node_modules', 'assets', 'content', 'coverage', 'reports', 'test-results', '.claude', '.github', '.githooks']);
  function walkMedia(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED.has(entry.name)) walkMedia(full);
        return;
      }
      if (MEDIA_EXT.has(path.extname(entry.name).toLowerCase())) {
        const rel = path.relative(ROOT, full).replace(/\\/g, '/');
        scanned.push(rel);
        violations.push(`${rel} — media files must live under assets/`);
      }
    });
  }
  walkMedia(ROOT);
}

if (rule === 'no-css-outside-styles') {
  const EXCLUDED = new Set(['node_modules', 'styles', 'coverage', 'reports', '.claude', '.github', '.githooks']);
  function walkCss(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED.has(entry.name)) walkCss(full);
        return;
      }
      if (path.extname(entry.name) === '.css') {
        const rel = path.relative(ROOT, full).replace(/\\/g, '/');
        scanned.push(rel);
        violations.push(`${rel} — CSS files must live under styles/`);
      }
    });
  }
  walkCss(ROOT);
}

if (rule === 'no-md-outside-docs') {
  // MACHINERY-SHAPE.md §3: only CLAUDE.md and README.md may sit at a repo root. The
  // TESTING.md / ARCHITECTURE.md exceptions went away when those two moved into
  // docs/; TESTING-GAPS.md and CONTRACT-VIOLATIONS.md were allowances for files
  // that never existed. A licence is not documentation.
  const ALLOWED_ROOT_FILES = new Set(['README.md', 'CLAUDE.md', 'LICENCE', 'LICENSE']);
  const EXCLUDED_DIRS = new Set(['node_modules', 'docs', 'coverage', 'reports', '.claude', '.github', '.githooks', 'test-results']);
  function walkMd(dir, depth) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
      const full = path.join(dir, entry.name);
      const rel = path.relative(ROOT, full).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) walkMd(full, depth + 1);
        return;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.md' || ext === '.txt') {
        if (depth === 0 && ALLOWED_ROOT_FILES.has(entry.name)) return;
        scanned.push(rel);
        violations.push(`${rel} — .md/.txt files must live under docs/`);
      }
    });
  }
  walkMd(ROOT, 0);
}

if (rule === 'no-pure-fn-outside-core') {
  // Named function declarations outside core/ with params + logic + no DOM access belong in core/.
  // "Logic" = top-level return OR Math.* / numeric computation in body.
  // Once in core/, check:untested enforces unit tests exist.
  const THIN_DISPATCHER = /^\s*return\s+\w+\[.*\]\s*\(.*\)\s*;?\s*$/s;
  const COMPUTATION_PATTERN = /\bMath\.\w+\s*\(|\bparseInt\b|\bparseFloat\b|\bNumber\b|\bisNaN\b|\bisFinite\b/;

  function hasLogic(body) {
    return hasTopLevelReturn(body) || COMPUTATION_PATTERN.test(body);
  }

  function extractFunctions(content) {
    const results = [];
    const fnRegex = /\bfunction\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
    let m;
    while ((m = fnRegex.exec(content)) !== null) {
      const params = m[2].trim();
      if (!params) continue;
      const name = m[1];
      const bodyStart = m.index + m[0].length;
      let depth = 1, i = bodyStart;
      while (i < content.length && depth > 0) {
        if (content[i] === '{') depth++;
        else if (content[i] === '}') depth--;
        i++;
      }
      const body = content.slice(bodyStart, i - 1);
      const line = content.slice(0, m.index).split('\n').length;
      results.push({ name, body, line });
    }
    return results;
  }

  function checkJsFile(file) {
    const content = read(file);
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    scanned.push(rel);
    extractFunctions(content).forEach(({ name, body, line }) => {
      if (DOM_PATTERN.test(body)) return;
      if (!hasLogic(body)) return;
      if (THIN_DISPATCHER.test(body)) return;
      violations.push(`${rel}:${line} — '${name}' has no DOM access; move to core/`);
    });
  }

  ['ui', 'components'].forEach(layer => {
    getAllFiles(path.join(ROOT, layer), ['.js']).forEach(checkJsFile);
  });

  getAllFiles(path.join(ROOT, 'app'), ['.html']).forEach(file => {
    const html = read(file);
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    extractInlineScripts(html).forEach((script, i) => {
      const label = rel + ' (block ' + (i + 1) + ')';
      scanned.push(label);
      extractFunctions(script).forEach(({ name, body, line }) => {
        if (DOM_PATTERN.test(body)) return;
        if (!hasTopLevelReturn(body)) return;
        if (THIN_DISPATCHER.test(body)) return;
        violations.push(`${label}:${line} — '${name}' has no DOM access; move to core/`);
      });
    });
  });
}

if (rule === 'no-logic-in-inline-callbacks') {
  getAllFiles(path.join(ROOT, 'app'), ['.html']).forEach(file => {
    const html = read(file);
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    extractInlineScripts(html).forEach((script, i) => {
      const label = rel + ' (block ' + (i + 1) + ')';
      scanned.push(label);
      detectInlineCallbackViolations(script).forEach(({ line }) => {
        violations.push(`${label}:${line} — transform callback with pure logic; extract to core/ + unit test`);
      });
    });
  });
}

let output = `## ${rule}\n`;

if (violations.length === 0) {
  output += `✅ No issues (scanned ${scanned.length} files)\n`;
} else {
  output += `❌ Violations (scanned ${scanned.length} files):\n`;
  violations.forEach(v => output += `- ${v}\n`);
}

output += `\nSUMMARY: ${violations.length === 0 ? '✅' : '❌'} ${violations.length} / ${scanned.length} files\n`;

if (require.main === module) {
  fs.writeFileSync(outputFile, output);
  console.log(output);
  process.exit(violations.length > 0 ? 1 : 0);
}

module.exports = { detectInlineCallbackViolations };
