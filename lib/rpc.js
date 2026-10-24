'use strict';
const { RPC_URL } = require('./config');

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

module.exports = { rpc };
