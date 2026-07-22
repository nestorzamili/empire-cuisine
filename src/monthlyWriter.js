(function (global) {
  const DATA_START = 3;
  const DATA_END = 112;
  const DATA_NUM_ROWS = DATA_END - DATA_START + 1;
  const DATA_COL = 2;
  const DATA_NUM_COLS = 9;
  const COL_PAX = 3;

  function clearSpreadsheetCache() {
    SheetCache.clear();
    if (global.SyncMetaStore) {
      SyncMetaStore.clearMemory();
    }
  }

  function emptyRowArray_() {
    return ['', '', '', '', '', 'false', 'false', '', ''];
  }

  function bookingToRow_(b) {
    return [
      b.time == null ? '' : b.time,
      b.name == null ? '' : b.name,
      '',
      b.pax == null ? '' : b.pax,
      b.phone == null ? '' : b.phone,
      b.arrival == null ? 'false' : b.arrival,
      b.finished == null ? 'false' : b.finished,
      b.food == null ? '' : b.food,
      b.remarks == null ? '' : b.remarks,
    ];
  }

  function applyRowToGrid_(grid, absRow, rowArr) {
    const idx = absRow - DATA_START;
    if (idx < 0 || idx >= grid.length) {
      return false;
    }
    rowArr[2] = grid[idx][2];
    grid[idx] = rowArr;
    return true;
  }

  function sumHallPax_(grid, hallRows) {
    let total = 0;
    for (let i = 0; i < hallRows.length; i++) {
      const idx = hallRows[i] - DATA_START;
      if (idx < 0 || idx >= grid.length) {
        continue;
      }
      const raw = grid[idx][COL_PAX];
      const paxNum = Number(raw);
      if (!Number.isNaN(paxNum) && raw !== '' && raw !== null) {
        total += paxNum;
      }
    }
    return total;
  }

  function resolveAbsRow_(booking) {
    if (booking.waiting) {
      const dinnerMeal = DaySheetLayout.isDinner(booking.type);
      const wlRows = dinnerMeal ? DaySheetLayout.DINNER_WL_ROWS : DaySheetLayout.LUNCH_WL_ROWS;
      let idx =
        booking.wlIndex === null || booking.wlIndex === undefined
          ? 0
          : Number(booking.wlIndex);
      if (!Number.isFinite(idx) || idx < 0) {
        idx = 0;
      }
      idx = Math.floor(idx);
      if (idx >= wlRows.length) {
        return wlRows[wlRows.length - 1];
      }
      return wlRows[idx];
    }
    return DaySheetLayout.hallRow(booking.hall, booking.type);
  }

  function resolveClearAbsRow_(slot) {
    if (slot.waiting) {
      const wlRows = slot.dinner ? DaySheetLayout.DINNER_WL_ROWS : DaySheetLayout.LUNCH_WL_ROWS;
      let idx = slot.wlIndex === null || slot.wlIndex === undefined ? 0 : Number(slot.wlIndex);
      if (!Number.isFinite(idx) || idx < 0) {
        idx = 0;
      }
      idx = Math.min(Math.floor(idx), wlRows.length - 1);
      return wlRows[idx];
    }
    return DaySheetLayout.hallRow(slot.hall, slot.dinner ? 'Dinner' : 'Lunch');
  }

  function applyDayUpdates(spreadsheetId, date, writes, clears) {
    const sheetName = Dates.daySheetName(date);
    const ss = SheetCache.get(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return {
        ok: false,
        sheetName: sheetName,
        written: 0,
        cleared: 0,
        errors: ['missing day sheet: ' + sheetName],
      };
    }

    try {
      const grid = sheet.getRange(DATA_START, DATA_COL, DATA_NUM_ROWS, DATA_NUM_COLS).getValues();
      let written = 0;
      let cleared = 0;
      const unknownHalls = [];

      for (let i = 0; i < clears.length; i++) {
        const absRow = resolveClearAbsRow_(clears[i]);
        if (absRow === null || absRow === undefined) {
          continue;
        }
        if (applyRowToGrid_(grid, absRow, emptyRowArray_())) {
          cleared++;
        }
      }

      for (let i = 0; i < writes.length; i++) {
        const booking = writes[i];
        const absRow = resolveAbsRow_(booking);
        if (absRow === null || absRow === undefined) {
          unknownHalls.push(booking.hall);
          continue;
        }
        if (applyRowToGrid_(grid, absRow, bookingToRow_(booking))) {
          written++;
        }
      }

      if (written === 0 && cleared === 0 && !unknownHalls.length) {
        return {
          ok: true,
          sheetName: sheetName,
          written: 0,
          cleared: 0,
          lunchPax: null,
          dinnerPax: null,
          unknownHalls: unknownHalls,
          errors: [],
        };
      }

      sheet.getRange(DATA_START, DATA_COL, DATA_NUM_ROWS, DATA_NUM_COLS).setValues(grid);

      const lunchPax = sumHallPax_(grid, DaySheetLayout.LUNCH_HALL_ROWS);
      const dinnerPax = sumHallPax_(grid, DaySheetLayout.DINNER_HALL_ROWS);
      const lunchCell = DaySheetLayout.LUNCH_PAX_TOTAL_CELL;
      const dinnerCell = DaySheetLayout.DINNER_PAX_TOTAL_CELL;
      sheet.getRange(lunchCell.row, lunchCell.col).setValue(lunchPax);
      sheet.getRange(dinnerCell.row, dinnerCell.col).setValue(dinnerPax);

      return {
        ok: true,
        sheetName: sheetName,
        written: written,
        cleared: cleared,
        lunchPax: lunchPax,
        dinnerPax: dinnerPax,
        unknownHalls: unknownHalls,
        errors: [],
      };
    } catch (e) {
      return {
        ok: false,
        sheetName: sheetName,
        written: 0,
        cleared: 0,
        errors: [e.message],
      };
    }
  }

  function clearDaySheet(sheet) {
    const grid = [];
    for (let i = 0; i < DATA_NUM_ROWS; i++) {
      grid.push(emptyRowArray_());
    }
    sheet.getRange(DATA_START, DATA_COL, DATA_NUM_ROWS, DATA_NUM_COLS).setValues(grid);
    sheet.getRange(DaySheetLayout.LUNCH_PAX_TOTAL_CELL.row, DaySheetLayout.LUNCH_PAX_TOTAL_CELL.col).setValue(0);
    sheet.getRange(DaySheetLayout.DINNER_PAX_TOTAL_CELL.row, DaySheetLayout.DINNER_PAX_TOTAL_CELL.col).setValue(0);
  }

  global.MonthlyWriter = {
    applyDayUpdates,
    clearDaySheet,
    clearSpreadsheetCache,
  };
})(globalThis);
