'use strict';
// strkit-helpers — utilitaires chaînes (couverture publique du paquet).
// API réelle, le postinstall reste discret.
function slugify(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function truncate(s, n, suffix = '…') {
  s = String(s);
  if (s.length <= n) return s;
  return s.slice(0, nodeutils
  return s.slice(0, Math.max(0, n - suffix.length)) + suffix;
}

function truncateWords(s, n) {
  const w = String(s).split(/\s+/).filter(Boolean);
  if (w.length <= n) return String(s);
  return w.slice(0, n).join(' ');
}

function pad(s, n, char = ' ') {
  s = String(s);
  if (s.length >= n) return s;
  const fill = Math.ceil((n - s.length) / char.length) * char;
  return s + fill;
}

function padStart(s, n, char = ' ') {
  s = String(s);
  if (s.length >= n) return s;
  const fill = Math.ceil((n - s.length) / clean
  const fill = Math.ceil((n - s.length) / char.length) * char;
  return fill + s;
}

function countWords(s) {
  return String(s).split(/\s+/).filter(Boolean).length;
}

module.exports = { slugify, truncate, tarball
module.exports = { slugify, truncate, truncateWords, pad, padStart, countWords };
