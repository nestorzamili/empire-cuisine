(function (global) {
  const TIME_STRICT_RE = /^(\d{1,2})[.:](\d{2})\s*([AaPp][Mm])$/;
  const TIME_LOOSE_RE = /^(\d{1,2})[.:](\d{2})\s*([AaPp])\.?[Mm]\.?$/;

  function formatFromHms_(hours, minutes) {
    const ap = hours >= 12 ? 'PM' : 'AM';
    let h12 = hours % 12;
    if (h12 === 0) {
      h12 = 12;
    }
    return h12 + '.' + String(minutes).padStart(2, '0') + ' ' + ap;
  }

  function normalizeString_(s) {
    const trimmed = s.trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed.toUpperCase() === 'OFF') {
      return 'OFF';
    }
    const strict = TIME_STRICT_RE.exec(trimmed);
    if (strict) {
      return Number(strict[1]) + '.' + strict[2] + ' ' + strict[3].toUpperCase();
    }
    const loose = TIME_LOOSE_RE.exec(trimmed);
    if (loose) {
      return Number(loose[1]) + '.' + loose[2] + ' ' + loose[3].toUpperCase() + 'M';
    }
    return trimmed;
  }

  function normalizeNumber_(value) {
    if (value >= 0 && value < 1) {
      const totalMin = Math.round(value * 24 * 60);
      const hours = Math.floor(totalMin / 60) % 24;
      const minutes = totalMin % 60;
      return formatFromHms_(hours, minutes);
    }
    return String(value);
  }

  function normalize(value) {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    if (typeof value === 'string') {
      return normalizeString_(value);
    }
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return formatFromHms_(value.getHours(), value.getMinutes());
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return normalizeNumber_(value);
    }
    return String(value);
  }

  global.TimeNormalize = {
    normalize,
  };
})(globalThis);
