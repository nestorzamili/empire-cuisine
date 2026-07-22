(function (global) {
  const TRY_WAIT_MS = 1000;
  const LEGACY_PROP = 'SYNC_LOCK';

  function clearLegacyPropertyLock_() {
    try {
      PropertiesService.getScriptProperties().deleteProperty(LEGACY_PROP);
    } catch (e) {}
  }

  function tryAcquire() {
    clearLegacyPropertyLock_();
    const lock = LockService.getScriptLock();
    try {
      if (!lock.tryLock(TRY_WAIT_MS)) {
        Log.warn(
          'Sync already running (script lock busy). Wait for the other execution to finish, then re-run.'
        );
        return false;
      }
      return true;
    } catch (e) {
      Log.warn('Could not acquire sync lock: ' + e.message);
      return false;
    }
  }

  function release() {
    try {
      LockService.getScriptLock().releaseLock();
    } catch (e) {}
  }

  global.SyncLock = {
    tryAcquire: tryAcquire,
    release: release,
  };
})(globalThis);
