(function (global) {
  function runInitial(options) {
    options = options || {};
    return reconcile_({
      reason: options.reason || 'runInitialSync',
      mode: 'initial',
      allowSkipMissingMonth: true,
      scheduleContinueOnPause: true,
    });
  }

  function runIncremental(options) {
    options = options || {};
    return reconcile_({
      reason: options.reason || 'runIncremental',
      mode: 'incremental',
      allowSkipMissingMonth: false,
      scheduleContinueOnPause: true,
    });
  }

  function runReconcile(options) {
    options = options || {};
    return reconcile_({
      reason: options.reason || 'runReconcile',
      mode: 'incremental',
      allowSkipMissingMonth: true,
      scheduleContinueOnPause: true,
    });
  }

  function reconcile_(opts) {
    const reason = opts.reason || 'reconcile';
    const mode = opts.mode || 'incremental';
    const isInitial = mode === 'initial';

    if (isInitial) {
      Log.clear();
    }
    Log.setSource(reason);

    if (isInitial && Config.isInitialSyncCompleted()) {
      Log.info(
        'Initial sync already done — edits flow via onMasterChange; use runReconcile to force a full pass'
      );
      Log.flush();
      return { ok: true, alreadyDone: true };
    }

    if (!SyncLock.tryAcquire()) {
      Log.warn('Reconcile skipped: another sync still holds the lock');
      if (isInitial) {
        Log.flush();
      }
      return { ok: false, skipped: true, reason: 'locked' };
    }

    const maxMs = Config.DEFAULTS.RECONCILE_MAX_MS || 5.5 * 60 * 1000;
    const started = Date.now();
    const stats = {
      bookings: 0,
      slots: 0,
      written: 0,
      unchanged: 0,
      cleared: 0,
      skippedUnknownHall: 0,
      duplicateSlots: 0,
      monthsTouched: 0,
      daysWritten: 0,
    };
    const notes = {
      unknownHalls: {},
      duplicateSamples: [],
      legacyMetaMonths: 0,
    };

    try {
      deleteContinuationTriggers_();

      const loaded = MasterReader.loadAllBookings();
      stats.bookings = loaded.bookings.length;

      const desired = buildDesiredState_(loaded.bookings, stats, notes);
      stats.slots = Object.keys(desired.bySlot).length;

      const monthMap = Config.getMonthFileIds();
      const monthKeys = Object.keys(monthMap).sort();

      Log.info(
        'Reconcile ' +
          mode +
          ': master ' +
          stats.bookings +
          ' bookings → ' +
          stats.slots +
          ' slots, ' +
          monthKeys.length +
          ' month file(s) mapped'
      );

      if (!monthKeys.length) {
        Log.warn('No MONTH_FILE_IDS — run generateMonthlyTemplates or refreshMonthIds first');
      }

      const missingMonths = {};
      const desiredMonths = Object.keys(desired.byMonth);
      for (let m = 0; m < desiredMonths.length; m++) {
        const ym = desiredMonths[m];
        if (!monthMap[ym]) {
          missingMonths[ym] = Object.keys(desired.byMonth[ym]).length;
        }
      }

      let paused = false;
      let pauseAtMonth = null;

      for (let i = 0; i < monthKeys.length; i++) {
        if (Date.now() - started > maxMs) {
          paused = true;
          pauseAtMonth = monthKeys[i];
          break;
        }

        const ym = monthKeys[i];
        const fileId = monthMap[ym];
        const monthDesired = desired.byMonth[ym] || {};

        const monthStats = reconcileMonth_(fileId, monthDesired, {
          started: started,
          maxMs: maxMs,
          notes: notes,
        });

        stats.written += monthStats.written;
        stats.unchanged += monthStats.unchanged;
        stats.cleared += monthStats.cleared;
        stats.skippedUnknownHall += monthStats.skippedUnknownHall;
        stats.daysWritten += monthStats.daysWritten;
        if (monthStats.touched) {
          stats.monthsTouched++;
        }

        if (monthStats.fatal) {
          SyncMetaStore.flush(fileId);
          logSideNotes_(notes, missingMonths, stats);
          Log.error(
            'Reconcile stopped on write error in ' +
              ym +
              ' (written=' +
              stats.written +
              ' cleared=' +
              stats.cleared +
              ')'
          );
          return { ok: false, completed: false, fatal: true, ...stats };
        }

        SyncMetaStore.flush(fileId);

        if (monthStats.paused) {
          paused = true;
          pauseAtMonth = ym;
          break;
        }
      }

      logSideNotes_(notes, missingMonths, stats);

      const elapsedMs = Date.now() - started;
      if (paused) {
        if (opts.scheduleContinueOnPause) {
          scheduleContinuation_(isInitial);
        }
        Log.info(
          'Reconcile paused at ' +
            (pauseAtMonth || '?') +
            ' (time budget); continuation scheduled — written=' +
            stats.written +
            ' cleared=' +
            stats.cleared +
            ' unchanged=' +
            stats.unchanged +
            ' (' +
            elapsedMs +
            'ms)'
        );
        return { ok: true, completed: false, stoppedEarly: true, ...stats };
      }

      const missingCount = Object.keys(missingMonths).length;
      if (isInitial) {
        Config.setInitialSyncCompleted(true);
        deleteContinuationTriggers_();
        Log.info(
          'Initial reconcile complete: written=' +
            stats.written +
            ' cleared=' +
            stats.cleared +
            ' unchanged=' +
            stats.unchanged +
            (missingCount ? ' missingMonths=' + missingCount : '') +
            ' (' +
            elapsedMs +
            'ms)'
        );
        return { ok: true, completed: true, ...stats, missingMonths: missingMonths };
      }

      if (missingCount && !opts.allowSkipMissingMonth) {
        Log.warn(
          'Reconcile finished but ' +
            missingCount +
            ' month file(s) missing for master bookings',
          missingMonths
        );
        return { ok: false, completed: true, missingMonths: missingMonths, ...stats };
      }

      if (stats.written === 0 && stats.cleared === 0) {
        Log.info(
          'Reconcile complete: no monthly changes (' +
            stats.slots +
            ' slots checked, ' +
            elapsedMs +
            'ms)'
        );
      } else {
        Log.info(
          'Reconcile complete: written=' +
            stats.written +
            ' cleared=' +
            stats.cleared +
            ' unchanged=' +
            stats.unchanged +
            ' days=' +
            stats.daysWritten +
            ' (' +
            elapsedMs +
            'ms)'
        );
      }
      return { ok: true, completed: true, ...stats };
    } catch (err) {
      Log.error('Reconcile failed: ' + err.message, { stack: err.stack });
      throw err;
    } finally {
      SyncLock.release();
      MonthlyWriter.clearSpreadsheetCache();
      if (isInitial) {
        Log.flush();
      }
    }
  }

  function buildDesiredState_(bookings, stats, notes) {
    const bySlot = {};
    const byMonth = {};

    for (let i = 0; i < bookings.length; i++) {
      const booking = bookings[i];
      const slotKey = booking.slotKey || SlotKey.forBooking(booking);
      if (!slotKey) {
        continue;
      }
      booking.slotKey = slotKey;
      booking.fingerprint = Fingerprint.compute(booking);

      if (bySlot[slotKey]) {
        stats.duplicateSlots++;
        if (notes.duplicateSamples.length < 5) {
          notes.duplicateSamples.push({
            slotKey: slotKey,
            rows: [bySlot[slotKey].masterRow, booking.masterRow],
          });
        }
      }
      bySlot[slotKey] = booking;

      const ym = Dates.yearMonth(booking.date);
      if (!byMonth[ym]) {
        byMonth[ym] = {};
      }
      byMonth[ym][slotKey] = booking;
    }

    return { bySlot: bySlot, byMonth: byMonth };
  }

  function isResolvableBooking_(booking) {
    if (booking.waiting) {
      return true;
    }
    return DaySheetLayout.hallRow(booking.hall, booking.type) !== null;
  }

  function reconcileMonth_(fileId, monthDesired, ctx) {
    const out = {
      written: 0,
      unchanged: 0,
      cleared: 0,
      skippedUnknownHall: 0,
      daysWritten: 0,
      fatal: false,
      paused: false,
      touched: false,
    };

    if (!fileId) {
      return out;
    }

    const loadInfo = SyncMetaStore.load(fileId);
    if (loadInfo.legacyReset) {
      ctx.notes.legacyMetaMonths++;
    }

    const metaMap = loadInfo.map;
    const desiredKeys = Object.keys(monthDesired);
    const metaKeys = Object.keys(metaMap);

    if (!desiredKeys.length && !metaKeys.length) {
      return out;
    }

    const dayBuckets = {};

    for (let i = 0; i < desiredKeys.length; i++) {
      const slotKey = desiredKeys[i];
      const booking = monthDesired[slotKey];
      const existing = metaMap[slotKey];
      if (existing && existing.fingerprint === booking.fingerprint) {
        out.unchanged++;
        continue;
      }
      if (!isResolvableBooking_(booking)) {
        out.skippedUnknownHall++;
        const h = String(booking.hall || '');
        ctx.notes.unknownHalls[h] = (ctx.notes.unknownHalls[h] || 0) + 1;
        continue;
      }
      const dk = booking.dateKey;
      if (!dayBuckets[dk]) {
        dayBuckets[dk] = { date: booking.date, writes: [], clears: [], clearKeys: [] };
      }
      dayBuckets[dk].writes.push(booking);
    }

    for (let i = 0; i < metaKeys.length; i++) {
      const slotKey = metaKeys[i];
      if (monthDesired[slotKey]) {
        continue;
      }
      const parsed = SlotKey.parse(slotKey);
      if (!parsed) {
        SyncMetaStore.remove(fileId, slotKey);
        out.cleared++;
        continue;
      }
      const dk = parsed.dateKey;
      if (!dayBuckets[dk]) {
        dayBuckets[dk] = {
          date: Dates.toDate(dk),
          writes: [],
          clears: [],
          clearKeys: [],
        };
      }
      dayBuckets[dk].clears.push(parsed);
      dayBuckets[dk].clearKeys.push(slotKey);
    }

    const dayKeys = Object.keys(dayBuckets).sort();
    if (!dayKeys.length) {
      return out;
    }

    out.touched = true;

    for (let d = 0; d < dayKeys.length; d++) {
      if (Date.now() - ctx.started > ctx.maxMs) {
        out.paused = true;
        return out;
      }

      const bucket = dayBuckets[dayKeys[d]];
      if (!bucket.date) {
        Log.error('Invalid dateKey for day batch: ' + dayKeys[d]);
        out.fatal = true;
        return out;
      }

      const result = MonthlyWriter.applyDayUpdates(
        fileId,
        bucket.date,
        bucket.writes,
        bucket.clears
      );

      if (!result.ok) {
        Log.error(
          'Day update failed ' +
            (result.sheetName || dayKeys[d]) +
            ': ' +
            (result.errors || []).join('; ')
        );
        out.fatal = true;
        return out;
      }

      for (let w = 0; w < bucket.writes.length; w++) {
        const booking = bucket.writes[w];
        SyncMetaStore.set(fileId, booking.slotKey, {
          fingerprint: booking.fingerprint,
          dateKey: booking.dateKey,
          masterRow: booking.masterRow,
        });
      }

      for (let c = 0; c < bucket.clearKeys.length; c++) {
        SyncMetaStore.remove(fileId, bucket.clearKeys[c]);
      }

      out.written += result.written;
      out.cleared += result.cleared;
      if (result.written || result.cleared) {
        out.daysWritten++;
        logDayLine_(result);
      }
    }

    return out;
  }

  function logDayLine_(result) {
    const parts = [];
    if (result.written) {
      parts.push(
        'Wrote ' + result.written + (result.written === 1 ? ' booking' : ' bookings')
      );
    }
    if (result.cleared) {
      const clearPart =
        result.cleared === 1 ? 'cleared 1 slot' : 'cleared ' + result.cleared + ' slots';
      if (!parts.length) {
        parts.push(clearPart.charAt(0).toUpperCase() + clearPart.slice(1));
      } else {
        parts.push(clearPart);
      }
    }
    if (!parts.length) {
      return;
    }
    let msg = parts.join(', ') + ' → ' + result.sheetName;
    if (result.lunchPax !== null && result.lunchPax !== undefined) {
      msg += ' (lunch pax ' + result.lunchPax + ', dinner pax ' + result.dinnerPax + ')';
    }
    Log.info(msg);
  }

  function logSideNotes_(notes, missingMonths, stats) {
    if (notes.legacyMetaMonths > 0) {
      Log.info(
        'Rebuilt legacy _SyncMeta on ' +
          notes.legacyMetaMonths +
          ' monthly file(s) (slotKey schema)'
      );
    }
    if (stats.duplicateSlots > 0) {
      Log.warn(
        'Master has ' + stats.duplicateSlots + ' duplicate slot(s); last row wins',
        notes.duplicateSamples.length ? { samples: notes.duplicateSamples } : undefined
      );
    }
    if (Object.keys(notes.unknownHalls).length) {
      Log.warn('Skipped unknown hall name(s)', notes.unknownHalls);
    }
    if (missingMonths && Object.keys(missingMonths).length) {
      Log.warn('Master bookings reference month file(s) not in MONTH_FILE_IDS', missingMonths);
    }
  }

  function scheduleContinuation_(isInitial) {
    deleteContinuationTriggers_();
    const delay = Config.DEFAULTS.CONTINUATION_DELAY_MS || 30 * 1000;
    const handler = isInitial ? 'continueInitialSync' : 'continueReconcile';
    ScriptApp.newTrigger(handler).timeBased().after(delay).create();
  }

  function deleteContinuationTriggers_() {
    const handlers = new Set(['continueInitialSync', 'continueReconcile']);
    const existing = ScriptApp.getProjectTriggers();
    for (let i = 0; i < existing.length; i++) {
      if (handlers.has(existing[i].getHandlerFunction())) {
        ScriptApp.deleteTrigger(existing[i]);
      }
    }
  }

  global.BookingSync = {
    runInitial: runInitial,
    runIncremental: runIncremental,
    runReconcile: runReconcile,
  };
})(globalThis);
