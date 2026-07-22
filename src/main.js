function setup() {
  Log.clear();
  Log.setSource('setup');

  try {
    const config = Config.setupConfig();
    if (config.removed && config.removed.length) {
      Log.info('Removed orphan Script properties: ' + config.removed.join(', '));
    }

    if (!config.ok) {
      Log.warn(
        'Setup incomplete — set required Script properties then re-run setup: ' +
          (config.missing || []).join(', ')
      );
      return {
        ok: false,
        step: 'config',
        config: config,
        log: null,
        triggers: false,
      };
    }

    const log = Log.ensureLogSpreadsheet();
    Triggers.setupTriggers();

    Log.info('Setup OK; trigger onMasterChange installed', {
      logId: log.id,
      removedProperties: config.removed || [],
    });
    return {
      ok: true,
      step: 'done',
      config: config,
      log: log,
      triggers: true,
    };
  } catch (err) {
    Log.error('Setup failed: ' + err.message, { stack: err.stack });
    throw err;
  } finally {
    Log.flush();
  }
}

function refreshMonthIds() {
  Log.clear();
  Log.setSource('refreshMonthIds');
  try {
    return MonthlyGenerator.refreshMonthIds();
  } finally {
    Log.flush();
  }
}

function generateMonthlyTemplates() {
  Log.clear();
  Log.setSource('generateMonthlyTemplates');
  try {
    const year = Config.DEFAULTS.TEMPLATE_YEAR;
    const results = MonthlyGenerator.generateYear(year, {});
    Log.info('generateMonthlyTemplates done', summarizeGenerate_(results));
    return results;
  } finally {
    Log.flush();
  }
}

function runInitialSync() {
  return BookingSync.runInitial({ reason: 'runInitialSync' });
}

function continueInitialSync() {
  return BookingSync.runInitial({ reason: 'continueInitialSync' });
}

function runReconcile() {
  Log.clear();
  Log.setSource('runReconcile');
  try {
    return BookingSync.runReconcile({ reason: 'runReconcile' });
  } finally {
    Log.flush();
  }
}

function continueReconcile() {
  Log.clear();
  Log.setSource('continueReconcile');
  try {
    return BookingSync.runReconcile({ reason: 'continueReconcile' });
  } finally {
    Log.flush();
  }
}

function onMasterChange(e) {
  if (e && e.changeType === 'FORMAT') {
    return;
  }

  Log.clear();
  Log.setSource('onMasterChange');

  if (!Config.isInitialSyncCompleted()) {
    Log.warn(
      'onMasterChange ignored (changeType=' +
        (e && e.changeType ? e.changeType : 'n/a') +
        '): run runInitialSync first'
    );
    Log.flush();
    return { ok: false, skipped: true, reason: 'initial_pending' };
  }

  try {
    return BookingSync.runIncremental({ reason: 'onMasterChange' });
  } finally {
    Log.flush();
  }
}

function summarizeGenerate_(results) {
  if (!results || !results.length) {
    return {};
  }
  let created = 0;
  let skipped = 0;
  let failed = 0;
  let stoppedEarly = false;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.stoppedEarly) {
      stoppedEarly = true;
      continue;
    }
    if (!r.ok) {
      failed++;
    } else if (r.skipped) {
      skipped++;
    } else {
      created++;
    }
  }
  return {
    total: results.length,
    created: created,
    skipped: skipped,
    failed: failed,
    stoppedEarly: stoppedEarly,
  };
}
