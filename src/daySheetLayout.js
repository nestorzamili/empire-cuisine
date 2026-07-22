(function (global) {
  const DINNER_OFFSET = 57;

  const HALL_ROWS = {
    '迎宾楼 1': 3,
    '迎宾楼 2': 4,
    'VVIP 8': 6,
    V1: 7,
    V2: 8,
    V3: 9,
    V5: 10,
    V6: 11,
    V7: 12,
    V9: 13,
    大厅: 15,
    T1: 17,
    T2: 18,
    T3: 19,
    T12: 20,
    T13: 21,
    T15: 22,
    T22: 23,
    T23: 24,
    T25: 25,
    T26: 26,
    T31: 27,
    T32: 28,
    T33: 29,
    T35: 30,
    T36: 31,
    T51: 32,
    T52: 33,
    T53: 34,
    T55: 35,
    T56: 36,
    T61: 37,
    T62: 38,
    T63: 39,
    T65: 40,
    T66: 41,
    T71: 42,
    T72: 43,
    T73: 44,
    T75: 45,
    T76: 46,
    T77: 47,
  };

  const LUNCH_HALL_ROWS = Object.keys(HALL_ROWS)
    .map((k) => HALL_ROWS[k])
    .sort((a, b) => a - b);

  const DINNER_HALL_ROWS = LUNCH_HALL_ROWS.map((r) => r + DINNER_OFFSET);

  const LUNCH_WL_ROWS = [52, 53, 54, 55];
  const DINNER_WL_ROWS = [109, 110, 111, 112];

  const LUNCH_PAX_TOTAL_CELL = { row: 48, col: 5 };
  const DINNER_PAX_TOTAL_CELL = { row: 105, col: 5 };

  function resolveBaseRow_(hall) {
    const key = String(hall).trim();
    if (HALL_ROWS[key] !== undefined) {
      return HALL_ROWS[key];
    }
    const lower = key.toLowerCase();
    for (const k of Object.keys(HALL_ROWS)) {
      if (k.toLowerCase() === lower) {
        return HALL_ROWS[k];
      }
    }
    return undefined;
  }

  function hallRow(hall, type) {
    if (!hall) {
      return null;
    }
    const base = resolveBaseRow_(hall);
    if (base === undefined) {
      return null;
    }
    if (isDinner(type)) {
      return base + DINNER_OFFSET;
    }
    return base;
  }

  function isDinner(type) {
    return (
      String(type || '')
        .trim()
        .toLowerCase() === 'dinner'
    );
  }

  function isWaiting(flag) {
    if (flag === true || flag === 1 || flag === '1') {
      return true;
    }
    if (typeof flag === 'string') {
      const s = flag.trim().toLowerCase();
      return s === 'true' || s === 'yes';
    }
    return false;
  }

  global.DaySheetLayout = {
    LUNCH_HALL_ROWS,
    DINNER_HALL_ROWS,
    LUNCH_WL_ROWS,
    DINNER_WL_ROWS,
    LUNCH_PAX_TOTAL_CELL,
    DINNER_PAX_TOTAL_CELL,
    hallRow,
    isDinner,
    isWaiting,
  };
})(globalThis);
