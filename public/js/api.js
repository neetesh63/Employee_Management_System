/**
 * api.js — Centralized fetch wrapper
 * Handles JSON, CSV, and error normalization.
 */
const API = (() => {
  const BASE = '/api';

  async function request(method, path, { body, params, blob } = {}) {
    const url = new URL(BASE + path, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
      });
    }
    const opts = {
      method,
      credentials: 'same-origin',
      headers: {},
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url.toString(), opts);

    if (blob) {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed.' }));
        throw new Error(err.error || 'Export failed.');
      }
      return res.blob();
    }

    const data = await res.json().catch(() => ({ error: res.statusText }));
    if (!res.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  return {
    get:    (path, opts) => request('GET',    path, opts),
    post:   (path, body, opts) => request('POST',   path, { body, ...opts }),
    put:    (path, body, opts) => request('PUT',    path, { body, ...opts }),
    patch:  (path, body, opts) => request('PATCH',  path, { body, ...opts }),
    delete: (path, opts) => request('DELETE', path, opts),
    getBlob:(path, opts) => request('GET',    path, { ...opts, blob: true }),
  };
})();
