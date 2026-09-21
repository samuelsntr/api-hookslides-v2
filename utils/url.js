import dns from 'node:dns/promises';
import net from 'node:net';

function privateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224;
  }

  const normalized = address.toLowerCase().split('%')[0];
  if (normalized.startsWith('::ffff:')) return privateIp(normalized.slice(7));
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || /^fe[89ab]/.test(normalized);
}

export function parseHttpUrl(value) {
  let url;
  const trimmed = String(value).trim();
  const candidate = !trimmed.includes('://') && !/\s/.test(trimmed) ? `https://${trimmed}` : trimmed;
  try { url = new URL(candidate); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  if ((url.protocol === 'http:' && url.port && url.port !== '80') || (url.protocol === 'https:' && url.port && url.port !== '443')) return null;

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) return null;
  return url;
}

export function isYouTubeHostname(hostname) {
  const normalized = String(hostname).toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  return normalized === 'youtu.be' || normalized === 'youtube.com' || normalized === 'm.youtube.com' ||
    normalized === 'music.youtube.com' || normalized === 'youtube-nocookie.com';
}

export function displayHostname(value) {
  const url = value instanceof URL ? value : parseHttpUrl(value);
  return url ? url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '') : '';
}

export async function isAllowedRemoteUrl(value, { lookup = dns.lookup } = {}) {
  const url = value instanceof URL ? value : parseHttpUrl(value);
  if (!url) return false;
  if (net.isIP(url.hostname)) return !privateIp(url.hostname);

  try {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    return addresses.length > 0 && !addresses.some(({ address }) => privateIp(address));
  } catch {
    return false;
  }
}
