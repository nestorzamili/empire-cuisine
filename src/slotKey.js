(function (global) {
  const SEP = '::';

  function mealCode(type) {
    return DaySheetLayout.isDinner(type) ? 'D' : 'L';
  }

  function normalizeHall_(hall) {
    return String(hall || '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function forBooking(booking) {
    if (!booking || !booking.dateKey) {
      return null;
    }
    const meal = mealCode(booking.type);
    if (booking.waiting) {
      const idx =
        booking.wlIndex === null || booking.wlIndex === undefined
          ? 0
          : Number(booking.wlIndex);
      return [booking.dateKey, meal, 'WL', String(Math.max(0, Math.floor(idx)))].join(SEP);
    }
    const hall = normalizeHall_(booking.hall);
    if (!hall) {
      return null;
    }
    return [booking.dateKey, meal, 'H', hall].join(SEP);
  }

  function parse(slotKey) {
    const parts = String(slotKey || '').split(SEP);
    if (parts.length < 4) {
      return null;
    }
    const dateKey = parts[0];
    const meal = parts[1];
    const kind = parts[2];
    if (meal !== 'L' && meal !== 'D') {
      return null;
    }
    if (kind === 'H') {
      return {
        slotKey: String(slotKey),
        dateKey: dateKey,
        dinner: meal === 'D',
        waiting: false,
        hall: parts.slice(3).join(SEP),
        wlIndex: null,
      };
    }
    if (kind === 'WL') {
      const wlIndex = Number(parts[3]);
      return {
        slotKey: String(slotKey),
        dateKey: dateKey,
        dinner: meal === 'D',
        waiting: true,
        hall: '',
        wlIndex: Number.isFinite(wlIndex) ? Math.floor(wlIndex) : 0,
      };
    }
    return null;
  }

  global.SlotKey = {
    mealCode: mealCode,
    forBooking: forBooking,
    parse: parse,
  };
})(globalThis);
