(function (global) {
  const HEADER_ALIASES = {
    hall: ['hall'],
    date: ['date'],
    time: ['time'],
    name: ['name'],
    type: ['type'],
    pax: ['pax'],
    phone: ['phone no', 'phone', 'phone no.', 'phoneno'],
    arrival: ['arrival'],
    finished: ['finished'],
    food: ['food reservation', 'food'],
    remarks: ['remarks', 'remark'],
    waiting: ['waiting list', 'waiting'],
  };

  function openMasterSheet_() {
    const ss = SpreadsheetApp.openById(Config.getMasterId());
    const sheet = getSheetCaseInsensitive_(ss, Config.getMasterSheetName());
    if (!sheet) {
      throw new Error('Master sheet not found: ' + Config.getMasterSheetName());
    }
    return sheet;
  }

  function loadAllBookings() {
    const sheet = openMasterSheet_();
    const sheetLast = sheet.getLastRow();
    if (sheetLast < 2) {
      return { bookings: [], lastRow: Math.max(sheetLast, 1) };
    }

    const lastCol = sheet.getLastColumn();
    const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const colMap = buildColMap_(header);
    requireCols_(colMap, ['hall', 'date', 'type']);

    const numRows = sheetLast - 1;
    const values = sheet.getRange(2, 1, numRows, lastCol).getValues();
    const bookings = [];
    const wlCounters = {};

    for (let i = 0; i < values.length; i++) {
      const booking = rowToBooking_(values[i], colMap, 2 + i);
      if (!booking) {
        continue;
      }
      if (booking.waiting) {
        const meal = SlotKey.mealCode(booking.type);
        const ck = booking.dateKey + '|' + meal;
        const idx = wlCounters[ck] || 0;
        booking.wlIndex = idx;
        wlCounters[ck] = idx + 1;
      } else {
        booking.wlIndex = null;
      }
      booking.slotKey = SlotKey.forBooking(booking);
      if (booking.slotKey) {
        bookings.push(booking);
      }
    }

    return { bookings: bookings, lastRow: sheetLast };
  }

  function buildColMap_(headerRow) {
    const map = {};
    for (let c = 0; c < headerRow.length; c++) {
      const raw = headerRow[c];
      if (raw === null || raw === undefined || raw === '') {
        continue;
      }
      const norm = String(raw)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      const fields = Object.keys(HEADER_ALIASES);
      for (let f = 0; f < fields.length; f++) {
        const field = fields[f];
        const aliases = HEADER_ALIASES[field];
        for (let a = 0; a < aliases.length; a++) {
          if (norm === aliases[a]) {
            map[field] = c;
          }
        }
      }
    }
    return map;
  }

  function requireCols_(colMap, fields) {
    const missing = [];
    for (let i = 0; i < fields.length; i++) {
      if (colMap[fields[i]] === undefined) {
        missing.push(fields[i]);
      }
    }
    if (missing.length) {
      throw new Error('Master header missing columns: ' + missing.join(', '));
    }
  }

  function cell_(row, colMap, field) {
    const idx = colMap[field];
    return idx === undefined ? null : row[idx];
  }

  function rowToBooking_(row, colMap, masterRow) {
    const date = Dates.toDate(cell_(row, colMap, 'date'));
    if (!date) {
      return null;
    }
    const hall = cell_(row, colMap, 'hall');
    if (hall === null || hall === undefined || String(hall).trim() === '') {
      return null;
    }
    const typeRaw = cell_(row, colMap, 'type');
    return {
      masterRow: masterRow,
      hall: String(hall).trim(),
      date: date,
      dateKey: Dates.ymd(date),
      time: TimeNormalize.normalize(cell_(row, colMap, 'time')),
      name: emptyToBlank_(cell_(row, colMap, 'name')),
      type: typeRaw === null || typeRaw === undefined ? '' : String(typeRaw).trim(),
      pax: emptyToBlank_(cell_(row, colMap, 'pax')),
      phone: emptyToBlank_(cell_(row, colMap, 'phone')),
      arrival: formatFlag_(cell_(row, colMap, 'arrival')),
      finished: formatFlag_(cell_(row, colMap, 'finished')),
      food: emptyToBlank_(cell_(row, colMap, 'food')),
      remarks: emptyToBlank_(cell_(row, colMap, 'remarks')),
      waiting: DaySheetLayout.isWaiting(cell_(row, colMap, 'waiting')),
    };
  }

  function emptyToBlank_(v) {
    if (v === null || v === undefined) {
      return '';
    }
    if (typeof v === 'string' && v.trim() === '') {
      return '';
    }
    return v;
  }

  function formatFlag_(v) {
    if (v === true || v === 1 || v === '1') {
      return 'true';
    }
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === 'true' || s === 'yes') {
        return 'true';
      }
      return 'false';
    }
    if (v === false || v === 0 || v === null || v === undefined || v === '') {
      return 'false';
    }
    return v ? 'true' : 'false';
  }

  function getSheetCaseInsensitive_(ss, name) {
    const want = String(name || '')
      .trim()
      .toLowerCase();
    const sheets = ss.getSheets();
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().trim().toLowerCase() === want) {
        return sheets[i];
      }
    }
    return ss.getSheetByName(name);
  }

  global.MasterReader = {
    loadAllBookings: loadAllBookings,
  };
})(globalThis);
