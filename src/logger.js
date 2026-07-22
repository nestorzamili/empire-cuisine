(function (global) {
  const LOG_SHEET_NAME = 'Log';
  const LOG_MAX_ROWS = 5000;

  let buffer_ = [];
  let source_ = '';
  let flushing_ = false;

  function setSource(source) {
    source_ = source || '';
  }

  function clear() {
    buffer_ = [];
  }

  function push_(level, message, detail) {
    const msg = message == null ? '' : String(message);
    const line = '[' + level + '] ' + msg;
    Logger.log(line);
    buffer_.push({
      timestamp: new Date(),
      level: level,
      source: source_,
      message: msg,
      detail: formatDetail_(detail),
    });
  }

  function formatDetail_(detail) {
    if (detail === null || detail === undefined || detail === '') {
      return '';
    }
    if (typeof detail === 'string') {
      return detail;
    }
    try {
      return JSON.stringify(detail);
    } catch (e) {
      return String(detail) + ' (json failed: ' + e.message + ')';
    }
  }

  function info(msg, detail) {
    push_('INFO', msg, detail);
  }

  function warn(msg, detail) {
    push_('WARN', msg, detail);
  }

  function error(msg, detail) {
    push_('ERROR', msg, detail);
  }

  function ensureLogSheet_(ss) {
    let sheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(LOG_SHEET_NAME, 0);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 5).setValues([['timestamp', 'level', 'source', 'message', 'detail']]);
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  function ensureLogSpreadsheet() {
    const id = Config.getLogSpreadsheetId();
    const ss = SpreadsheetApp.openById(id);
    ensureLogSheet_(ss);
    return {
      ok: true,
      id: id,
      url: 'https://docs.google.com/spreadsheets/d/' + id + '/edit',
    };
  }

  function getLogSpreadsheet_() {
    return SpreadsheetApp.openById(Config.getLogSpreadsheetId());
  }

  function archiveName_() {
    return (
      'Log archive ' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
    );
  }

  function uniqueSheetName_(ss, base) {
    if (!ss.getSheetByName(base)) {
      return base;
    }
    let n = 2;
    while (ss.getSheetByName(base + ' (' + n + ')')) {
      n++;
    }
    return base + ' (' + n + ')';
  }

  function archiveIfFull_(ss, sheet) {
    const dataRows = Math.max(0, sheet.getLastRow() - 1);
    if (dataRows < LOG_MAX_ROWS) {
      return sheet;
    }
    const name = uniqueSheetName_(ss, archiveName_());
    sheet.setName(name);
    Logger.log('[INFO] Archived log sheet as: ' + name);
    return ensureLogSheet_(ss);
  }

  function flush() {
    if (flushing_ || buffer_.length === 0) {
      return { written: 0 };
    }
    flushing_ = true;
    try {
      const ss = getLogSpreadsheet_();
      let sheet = ensureLogSheet_(ss);
      sheet = archiveIfFull_(ss, sheet);
      const rows = buffer_.map(function (e) {
        return [e.timestamp, e.level, e.source, e.message, e.detail];
      });
      const startRow = Math.max(sheet.getLastRow() + 1, 2);
      sheet.getRange(startRow, 1, rows.length, 5).setValues(rows);
      buffer_ = [];
      return { written: rows.length };
    } catch (e) {
      Logger.log('[ERROR] Log.flush failed: ' + e.message);
      return { written: 0, error: e.message };
    } finally {
      flushing_ = false;
    }
  }

  global.Log = {
    setSource: setSource,
    clear: clear,
    info: info,
    warn: warn,
    error: error,
    flush: flush,
    ensureLogSpreadsheet: ensureLogSpreadsheet,
  };
})(globalThis);
