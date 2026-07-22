(function (global) {
  const DEFAULTS = {
    MASTER_SHEET_NAME: 'Sheet1',
    TEMPLATE_YEAR: 2026,
    RECONCILE_MAX_MS: 5.5 * 60 * 1000,
    CONTINUATION_DELAY_MS: 30 * 1000,
  };

  const PROP_KEYS = {
    MASTER_SPREADSHEET_ID: 'MASTER_SPREADSHEET_ID',
    MASTER_SHEET_NAME: 'MASTER_SHEET_NAME',
    MONTHLY_FOLDER_ID: 'MONTHLY_FOLDER_ID',
    LOG_SPREADSHEET_ID: 'LOG_SPREADSHEET_ID',
    TEMPLATE_SPREADSHEET_ID: 'TEMPLATE_SPREADSHEET_ID',
    MONTH_FILE_IDS: 'MONTH_FILE_IDS',
    INITIAL_SYNC_COMPLETED: 'INITIAL_SYNC_COMPLETED',
  };

  const REQUIRED_RESOURCE_KEYS = [
    PROP_KEYS.MASTER_SPREADSHEET_ID,
    PROP_KEYS.MONTHLY_FOLDER_ID,
    PROP_KEYS.LOG_SPREADSHEET_ID,
    PROP_KEYS.TEMPLATE_SPREADSHEET_ID,
  ];

  function props_() {
    return PropertiesService.getScriptProperties();
  }

  function missingPropMessage_(key) {
    return (
      'Missing Script Property "' +
      key +
      '". Set it in Project Settings → Script properties, then run setup().'
    );
  }

  function getRequired_(key) {
    const p = props_().getProperty(key);
    if (p !== null && p !== '') {
      return p;
    }
    throw new Error(missingPropMessage_(key));
  }

  function get(key) {
    const p = props_().getProperty(key);
    if (p !== null && p !== '') {
      return p;
    }
    if (Object.hasOwn(DEFAULTS, key)) {
      const v = DEFAULTS[key];
      return typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
    return null;
  }

  function set(key, value) {
    props_().setProperty(key, String(value));
  }

  function getMasterId() {
    return getRequired_(PROP_KEYS.MASTER_SPREADSHEET_ID);
  }

  function getMasterSheetName() {
    const p = props_().getProperty(PROP_KEYS.MASTER_SHEET_NAME);
    if (p !== null && p !== '') {
      return p;
    }
    return DEFAULTS.MASTER_SHEET_NAME;
  }

  function getMonthlyFolderId() {
    return getRequired_(PROP_KEYS.MONTHLY_FOLDER_ID);
  }

  function getTemplateId() {
    return getRequired_(PROP_KEYS.TEMPLATE_SPREADSHEET_ID);
  }

  function getLogSpreadsheetId() {
    return getRequired_(PROP_KEYS.LOG_SPREADSHEET_ID);
  }

  function getMonthFileIds() {
    const raw = props_().getProperty(PROP_KEYS.MONTH_FILE_IDS);
    if (!raw) {
      return {};
    }
    try {
      const map = JSON.parse(raw);
      if (!map || typeof map !== 'object' || Array.isArray(map)) {
        return {};
      }
      return map;
    } catch (e) {
      Logger.log('[WARN] Invalid MONTH_FILE_IDS JSON: ' + e.message);
      return {};
    }
  }

  function setMonthFileIds(map) {
    set(PROP_KEYS.MONTH_FILE_IDS, JSON.stringify(map || {}));
  }

  function getMonthFileId(yearMonth) {
    return getMonthFileIds()[yearMonth] || null;
  }

  function isInitialSyncCompleted() {
    return props_().getProperty(PROP_KEYS.INITIAL_SYNC_COMPLETED) === 'true';
  }

  function setInitialSyncCompleted(done) {
    if (done) {
      set(PROP_KEYS.INITIAL_SYNC_COMPLETED, 'true');
    } else {
      props_().deleteProperty(PROP_KEYS.INITIAL_SYNC_COMPLETED);
    }
  }

  function listMissingResourceKeys() {
    const missing = [];
    for (let i = 0; i < REQUIRED_RESOURCE_KEYS.length; i++) {
      const key = REQUIRED_RESOURCE_KEYS[i];
      const v = props_().getProperty(key);
      if (v === null || v === '') {
        missing.push(key);
      }
    }
    return missing;
  }

  function pruneOrphanProperties_() {
    const allowed = new Set();
    const keys = Object.keys(PROP_KEYS);
    for (let i = 0; i < keys.length; i++) {
      allowed.add(PROP_KEYS[keys[i]]);
    }
    const p = props_();
    const removed = [];
    const existing = p.getKeys();
    for (let i = 0; i < existing.length; i++) {
      const key = existing[i];
      if (!allowed.has(key)) {
        p.deleteProperty(key);
        removed.push(key);
      }
    }
    return removed.sort();
  }

  function setupConfig() {
    const removed = pruneOrphanProperties_();
    const missing = listMissingResourceKeys();
    return {
      ok: missing.length === 0,
      missing: missing,
      removed: removed,
    };
  }

  global.Config = {
    DEFAULTS: DEFAULTS,
    PROP_KEYS: PROP_KEYS,
    get: get,
    set: set,
    getMasterId: getMasterId,
    getMasterSheetName: getMasterSheetName,
    getMonthlyFolderId: getMonthlyFolderId,
    getTemplateId: getTemplateId,
    getLogSpreadsheetId: getLogSpreadsheetId,
    getMonthFileIds: getMonthFileIds,
    setMonthFileIds: setMonthFileIds,
    getMonthFileId: getMonthFileId,
    isInitialSyncCompleted: isInitialSyncCompleted,
    setInitialSyncCompleted: setInitialSyncCompleted,
    setupConfig: setupConfig,
  };
})(globalThis);
