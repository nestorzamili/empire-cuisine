(function (global) {
  const META_SHEET = '_SyncMeta';
  const HEADER = ['slotKey', 'fingerprint', 'dateKey', 'masterRow', 'updatedAt'];
  const maps_ = {};
  const dirty_ = {};

  function ensureSheet_(ss) {
    let sheet = ss.getSheetByName(META_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(META_SHEET);
      writeHeader_(sheet);
      sheet.hideSheet();
      return sheet;
    }
    if (sheet.getLastRow() === 0) {
      writeHeader_(sheet);
    }
    if (!sheet.isSheetHidden()) {
      sheet.hideSheet();
    }
    return sheet;
  }

  function writeHeader_(sheet) {
    sheet.clear();
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
    sheet.getRange(1, 1, 1, 3).setNumberFormat('@');
    sheet.setFrozenRows(1);
  }

  function ensureSheet(spreadsheetId) {
    ensureSheet_(SheetCache.get(spreadsheetId));
  }

  function isLegacyHeader_(headerRow) {
    const first = String((headerRow && headerRow[0]) || '')
      .trim()
      .toLowerCase();
    return first === 'fingerprint' || (first && first !== 'slotkey');
  }

  function load(spreadsheetId) {
    if (maps_[spreadsheetId]) {
      return { map: maps_[spreadsheetId], legacyReset: false };
    }
    const ss = SheetCache.get(spreadsheetId);
    const sheet = ensureSheet_(ss);
    const map = {};
    const last = sheet.getLastRow();
    if (last >= 1) {
      const header = sheet.getRange(1, 1, 1, HEADER.length).getValues()[0];
      if (isLegacyHeader_(header)) {
        writeHeader_(sheet);
        maps_[spreadsheetId] = map;
        dirty_[spreadsheetId] = true;
        return { map: map, legacyReset: true };
      }
    }
    if (last >= 2) {
      const values = sheet.getRange(2, 1, last - 1, HEADER.length).getValues();
      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const slotKey = String(row[0] || '').trim();
        const fp = String(row[1] || '').trim();
        if (!slotKey || !fp) {
          continue;
        }
        map[slotKey] = {
          fingerprint: fp,
          dateKey: String(row[2] || ''),
          masterRow:
            row[3] === '' || row[3] === null || row[3] === undefined ? null : Number(row[3]),
        };
      }
    }
    maps_[spreadsheetId] = map;
    dirty_[spreadsheetId] = false;
    return { map: map, legacyReset: false };
  }

  function get(spreadsheetId, slotKey) {
    if (!slotKey) {
      return null;
    }
    return load(spreadsheetId).map[slotKey] || null;
  }

  function set(spreadsheetId, slotKey, entry) {
    if (!slotKey || !entry || !entry.fingerprint) {
      return;
    }
    const map = load(spreadsheetId).map;
    map[slotKey] = {
      fingerprint: String(entry.fingerprint),
      dateKey: entry.dateKey || '',
      masterRow:
        entry.masterRow === null || entry.masterRow === undefined || entry.masterRow === ''
          ? null
          : Number(entry.masterRow),
    };
    dirty_[spreadsheetId] = true;
  }

  function remove(spreadsheetId, slotKey) {
    if (!slotKey) {
      return;
    }
    const map = load(spreadsheetId).map;
    if (Object.hasOwn(map, slotKey)) {
      delete map[slotKey];
      dirty_[spreadsheetId] = true;
    }
  }

  function keys(spreadsheetId) {
    return Object.keys(load(spreadsheetId).map);
  }

  function flush(spreadsheetId) {
    if (!dirty_[spreadsheetId]) {
      return;
    }
    const map = load(spreadsheetId).map;
    const ss = SheetCache.get(spreadsheetId);
    const sheet = ensureSheet_(ss);
    writeHeader_(sheet);

    const slotKeys = Object.keys(map);
    if (slotKeys.length) {
      const now = new Date().toISOString();
      const rows = [];
      for (let i = 0; i < slotKeys.length; i++) {
        const sk = slotKeys[i];
        const e = map[sk];
        rows.push([
          sk,
          e.fingerprint || '',
          e.dateKey || '',
          e.masterRow === null || e.masterRow === undefined ? '' : e.masterRow,
          now,
        ]);
      }
      sheet.getRange(2, 1, rows.length, HEADER.length).setValues(rows);
    }
    dirty_[spreadsheetId] = false;
  }

  function flushAll() {
    const ids = Object.keys(maps_);
    for (let i = 0; i < ids.length; i++) {
      flush(ids[i]);
    }
  }

  function clearAll(spreadsheetId) {
    const ss = SheetCache.get(spreadsheetId);
    const existing = ss.getSheetByName(META_SHEET);
    if (existing) {
      writeHeader_(existing);
      if (!existing.isSheetHidden()) {
        existing.hideSheet();
      }
    } else {
      ensureSheet_(ss);
    }
    maps_[spreadsheetId] = {};
    dirty_[spreadsheetId] = false;
  }

  function clearMemory() {
    const mapIds = Object.keys(maps_);
    for (let i = 0; i < mapIds.length; i++) {
      delete maps_[mapIds[i]];
    }
    const dirtyIds = Object.keys(dirty_);
    for (let j = 0; j < dirtyIds.length; j++) {
      delete dirty_[dirtyIds[j]];
    }
  }

  global.SyncMetaStore = {
    ensureSheet: ensureSheet,
    load: load,
    get: get,
    set: set,
    remove: remove,
    keys: keys,
    flush: flush,
    flushAll: flushAll,
    clearAll: clearAll,
    clearMemory: clearMemory,
  };
})(globalThis);
