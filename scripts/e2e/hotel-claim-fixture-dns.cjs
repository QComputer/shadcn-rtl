/* eslint-disable @typescript-eslint/no-require-imports -- Node DNS preload must run as CommonJS. */
// Local test client only. Preserve URL, Host and Origin; never edit system DNS.
'use strict';
const dns = require('node:dns');
const {syncBuiltinESMExports} = require('node:module');
const allowed = new Set(['phone-auth.localhost','wrong-phone-auth.localhost','appointment-auth.localhost','source-sso.localhost','target-sso.localhost']);
const original = dns.lookup;
dns.lookup = function(host, opts, cb) {
  if (!allowed.has(host) && !/^recovery-[0-9a-f-]{36}\.localhost$/.test(host)) return Reflect.apply(original, this, arguments);
  if (typeof opts === 'function') {cb=opts;opts={};}
  if (typeof opts === 'number') opts={family:opts};
  opts=opts||{};
  if (typeof cb !== 'function') throw new TypeError('Expected DNS lookup callback');
  const family=opts.family;
  if (family===6 || family==='IPv6') {
    const e=Object.assign(new Error('IPv4-only synthetic fixture'),{code:'ENOTFOUND',hostname:host,syscall:'getaddrinfo'});
    return process.nextTick(cb,e);
  }
  return process.nextTick(cb,null, ...(opts.all ? [[{address:'127.0.0.1',family:4}]] : ['127.0.0.1',4]));
};
syncBuiltinESMExports();
