(function (global) {
  const CN_MONTH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  const EN_MONTH = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const EN_MONTH_TO_NUM = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
  };
  const GOOGLE_SHEETS_MIME = 'application/vnd.google-apps.spreadsheet';
  const MONTH_NAME_RE =
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i;
  const TMP_DAY_RE = /__tmp_day_(\d+)/;
  const MAX_GENERATE_MS = 5 * 60 * 1000;

  function fileName(year, month) {
    return CN_MONTH[month - 1] + ' ' + EN_MONTH[month - 1] + ' ' + year + ' _ 御膳楼预约';
  }

  function yearMonthKey_(year, month) {
    return year + '-' + String(month).padStart(2, '0');
  }

  function isMetaSheet_(name) {
    const n = String(name).trim().toLowerCase();
    return n === 'date' || n === 'note' || n === 'notes' || n === '_syncmeta';
  }

  function listDaySheets_(ss) {
    return ss.getSheets().filter((sh) => !isMetaSheet_(sh.getName()));
  }

  function findSheetCi_(ss, names) {
    const want = new Set(names.map((n) => n.toLowerCase()));
    for (const sh of ss.getSheets()) {
      if (want.has(sh.getName().trim().toLowerCase())) {
        return sh;
      }
    }
    return null;
  }

  function ensureDateSheet_(ss) {
    let sheet = findSheetCi_(ss, ['Date']);
    if (!sheet) {
      sheet = ss.insertSheet('Date', 0);
    }
    return sheet;
  }

  function ensureNoteSheet_(ss) {
    let sheet = findSheetCi_(ss, ['Note', 'Notes']);
    if (!sheet) {
      sheet = ss.insertSheet('Note', 1);
    }
    return sheet;
  }

  function moveToMonthlyFolder_(fileId) {
    const file = DriveApp.getFileById(fileId);
    const folder = DriveApp.getFolderById(Config.getMonthlyFolderId());
    folder.addFile(file);
    const parents = file.getParents();
    while (parents.hasNext()) {
      const parent = parents.next();
      if (parent.getId() !== folder.getId()) {
        parent.removeFile(file);
      }
    }
  }

  function findExistingInFolder_(name) {
    const files = DriveApp.getFolderById(Config.getMonthlyFolderId()).getFilesByName(name);
    return files.hasNext() ? files.next().getId() : null;
  }

  function targetDayNames_(year, month) {
    const nDays = Dates.daysInMonth(year, month);
    const names = [];
    for (let d = 1; d <= nDays; d++) {
      names.push(Dates.daySheetName(new Date(year, month - 1, d)));
    }
    return names;
  }

  function isMonthComplete_(ss, year, month) {
    if (!findSheetCi_(ss, ['Date'])) {
      return false;
    }
    if (!findSheetCi_(ss, ['Note', 'Notes'])) {
      return false;
    }
    const targets = targetDayNames_(year, month);
    for (const name of targets) {
      if (!ss.getSheetByName(name)) {
        return false;
      }
    }
    return true;
  }

  function rebuildMonth_(ss, year, month) {
    const targetNames = targetDayNames_(year, month);
    const nDays = targetNames.length;

    const dateSheet = ensureDateSheet_(ss);
    ensureNoteSheet_(ss);

    let daySheets = listDaySheets_(ss);
    if (!daySheets.length) {
      throw new Error('No day sheet template found (need at least one day tab besides Date/Note)');
    }

    while (daySheets.length < nDays) {
      const src = daySheets.at(-1);
      const copied = src.copyTo(ss);
      copied.setName('__new_' + daySheets.length);
      daySheets.push(copied);
    }

    while (daySheets.length > nDays) {
      ss.deleteSheet(daySheets.pop());
    }

    for (let i = 0; i < daySheets.length; i++) {
      daySheets[i].setName('__tmp_day_' + i);
    }
    SpreadsheetApp.flush();

    daySheets = listDaySheets_(ss);
    daySheets.sort((a, b) => {
      const ma = TMP_DAY_RE.exec(a.getName());
      const mb = TMP_DAY_RE.exec(b.getName());
      return Number(ma ? ma[1] : 0) - Number(mb ? mb[1] : 0);
    });

    for (let j = 0; j < nDays; j++) {
      daySheets[j].setName(targetNames[j]);
      MonthlyWriter.clearDaySheet(daySheets[j]);
    }

    const dateValues = [[year]];
    for (const name of targetNames) {
      dateValues.push([name]);
    }
    dateSheet.clearContents();
    dateSheet.getRange(1, 1, dateValues.length, 1).setValues(dateValues);

    SyncMetaStore.clearAll(ss.getId());
    SyncMetaStore.ensureSheet(ss.getId());
    return targetNames;
  }

  function resolveExistingId_(name, key) {
    return findExistingInFolder_(name) || Config.getMonthFileId(key) || null;
  }

  function generateMonth(year, month, options) {
    options = options || {};
    if (month < 1 || month > 12) {
      throw new Error('month must be 1-12');
    }

    const key = yearMonthKey_(year, month);
    const name = fileName(year, month);

    const existingId = resolveExistingId_(name, key);
    if (existingId && !options.force) {
      const ss = SpreadsheetApp.openById(existingId);
      if (isMonthComplete_(ss, year, month)) {
        SyncMetaStore.ensureSheet(existingId);
        return { ok: true, skipped: true, id: existingId, name, key };
      }
      const dayNames = rebuildMonth_(ss, year, month);
      return {
        ok: true,
        skipped: false,
        repaired: true,
        id: existingId,
        name,
        key,
        days: dayNames.length,
        url: 'https://docs.google.com/spreadsheets/d/' + existingId + '/edit',
      };
    }

    const templateId = options.templateId || Config.getTemplateId();
    const copyId = SpreadsheetApp.openById(templateId).copy(name).getId();
    moveToMonthlyFolder_(copyId);
    const dayNames = rebuildMonth_(SpreadsheetApp.openById(copyId), year, month);

    return {
      ok: true,
      skipped: false,
      id: copyId,
      name,
      key,
      days: dayNames.length,
      url: 'https://docs.google.com/spreadsheets/d/' + copyId + '/edit',
    };
  }

  function generateYear(year, options) {
    options = options || {};
    const results = [];
    const started = Date.now();
    let stoppedEarly = false;
    const map = Config.getMonthFileIds();

    for (let m = 1; m <= 12; m++) {
      if (Date.now() - started > MAX_GENERATE_MS) {
        stoppedEarly = true;
        Log.warn('generateYear stopped early near Apps Script time limit', {
          lastCompletedMonth: m - 1,
          year,
        });
        break;
      }

      const key = yearMonthKey_(year, m);
      try {
        const result = generateMonth(year, m, options);
        results.push(result);
        if (result.ok && result.id) {
          map[result.key] = result.id;
        }
      } catch (e) {
        Log.error('Failed ' + key + ': ' + e.message);
        results.push({ ok: false, key, error: e.message });
      }
    }

    Config.setMonthFileIds(map);
    if (stoppedEarly) {
      results.push({
        ok: false,
        stoppedEarly: true,
        message: 'Re-run generateMonthlyTemplates to continue',
      });
    }
    return results;
  }

  function isSpreadsheetMime_(mime) {
    return mime === GOOGLE_SHEETS_MIME || String(mime).includes('spreadsheet');
  }

  function refreshMonthIds() {
    const folder = DriveApp.getFolderById(Config.getMonthlyFolderId());
    const files = folder.getFiles();
    const map = Config.getMonthFileIds();
    let found = 0;

    while (files.hasNext()) {
      const f = files.next();
      if (!isSpreadsheetMime_(f.getMimeType())) {
        continue;
      }
      const m = MONTH_NAME_RE.exec(f.getName());
      if (!m) {
        continue;
      }
      const key = m[2] + '-' + EN_MONTH_TO_NUM[m[1].toLowerCase()];
      map[key] = f.getId();
      found++;
    }

    Config.setMonthFileIds(map);
    Log.info('refreshMonthIds: ' + found + ' files');
    return map;
  }

  global.MonthlyGenerator = {
    generateYear,
    refreshMonthIds,
  };
})(globalThis);
