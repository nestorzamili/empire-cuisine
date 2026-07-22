(function (global) {
  const VERSION = 'v1';

  function normalizeScalar_(v) {
    if (v === null || v === undefined) {
      return '';
    }
    if (typeof v === 'boolean') {
      return v ? 'true' : 'false';
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      return String(v);
    }
    return String(v);
  }

  function toCanonical_(b) {
    return [
      normalizeScalar_(b.hall),
      normalizeScalar_(b.dateKey),
      normalizeScalar_(b.type),
      b.waiting ? '1' : '0',
      normalizeScalar_(b.time),
      normalizeScalar_(b.name),
      normalizeScalar_(b.pax),
      normalizeScalar_(b.phone),
      normalizeScalar_(b.arrival),
      normalizeScalar_(b.finished),
      normalizeScalar_(b.food),
      normalizeScalar_(b.remarks),
    ];
  }

  function sha256Hex_(text) {
    const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
    return raw
      .map((byte) => {
        const v = byte < 0 ? byte + 256 : byte;
        return ('0' + v.toString(16)).slice(-2);
      })
      .join('');
  }

  function compute(booking) {
    if (!booking) {
      return VERSION + ':' + sha256Hex_('[]');
    }
    const canonical = JSON.stringify(toCanonical_(booking));
    return VERSION + ':' + sha256Hex_(canonical);
  }

  global.Fingerprint = {
    compute,
  };
})(globalThis);
