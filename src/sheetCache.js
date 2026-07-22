(function (global) {
  const cache_ = {};

  function get(spreadsheetId) {
    if (!cache_[spreadsheetId]) {
      cache_[spreadsheetId] = SpreadsheetApp.openById(spreadsheetId);
    }
    return cache_[spreadsheetId];
  }

  function clear() {
    for (const k of Object.keys(cache_)) {
      delete cache_[k];
    }
  }

  global.SheetCache = {
    get,
    clear,
  };
})(globalThis);
