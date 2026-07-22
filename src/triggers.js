(function (global) {
  const HANDLERS = {
    onChange: 'onMasterChange',
    continueInitial: 'continueInitialSync',
    continueReconcile: 'continueReconcile',
  };

  function setupTriggers() {
    removeManagedTriggers_();

    const masterId = Config.getMasterId();
    ScriptApp.newTrigger(HANDLERS.onChange).forSpreadsheet(masterId).onChange().create();
  }

  function removeManagedTriggers_() {
    const managed = new Set([
      HANDLERS.onChange,
      HANDLERS.continueInitial,
      HANDLERS.continueReconcile,
    ]);
    const existing = ScriptApp.getProjectTriggers();
    for (const t of existing) {
      if (managed.has(t.getHandlerFunction())) {
        ScriptApp.deleteTrigger(t);
      }
    }
  }

  global.Triggers = {
    setupTriggers,
  };
})(globalThis);
