(function (global) {
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const YMD_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})/;

  function toDate(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return startOfDay(value);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const ms = epoch.getTime() + Math.round(value) * 86400000;
      const d = new Date(ms);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    if (typeof value === 'string') {
      const s = value.trim();
      const m = YMD_RE.exec(s);
      if (m) {
        return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      }
      const parsed = new Date(s);
      if (!Number.isNaN(parsed.getTime())) {
        return startOfDay(parsed);
      }
    }
    return null;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function ymd(d) {
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function yearMonth(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function daySheetName(d) {
    return (
      d.getDate() +
      ' ' +
      MON[d.getMonth()] +
      ' ' +
      String(d.getFullYear()).slice(2) +
      ' (' +
      DOW[d.getDay()] +
      ')'
    );
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  global.Dates = {
    toDate,
    ymd,
    yearMonth,
    daySheetName,
    daysInMonth,
  };
})(globalThis);
