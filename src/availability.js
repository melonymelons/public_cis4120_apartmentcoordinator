export const APARTMENT_TIME_ZONE = 'America/New_York';
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const AVAILABILITY_STATUSES = ['Home & free', 'Leaving soon', 'Studying', 'Away'];

function minutes(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return null;
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
}
function validWindow(window) {
  return (window?.date ? validDate(window.date) : Array.isArray(window?.days) && window.days.length > 0 && window.days.every(d => Number.isInteger(d) && d >= 0 && d < 7))
    && minutes(window.start) !== null && minutes(window.end) !== null && window.start !== window.end && AVAILABILITY_STATUSES.includes(window.status);
}
function validDate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date || '') && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}
export function apartmentDate(now = Date.now(), timeZone = APARTMENT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function shiftDate(date, days) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export const dateDay = date => new Date(`${date}T12:00:00Z`).getUTCDay();
export const availabilityIsBusy = status => ['Studying', 'Away'].includes(status);
export const availabilityText = status => status === 'Unknown' ? 'Not shared' : availabilityIsBusy(status) ? 'Busy' : 'Free';
export const canReceiveTask = (person, now = Date.now()) => Boolean(person) && !availabilityIsBusy(getAvailability(person, now).status);
export function formatAvailabilityDate(date) {
  return validDate(date) ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`)) : '';
}
function intervals(window) {
  if (!validWindow(window)) return [];
  const start = minutes(window.start), end = minutes(window.end);
  return [...new Set(window.days)].flatMap(day => {
    const from = day * 1440 + start;
    const to = day * 1440 + end + (end < start ? 1440 : 0);
    return to <= 10080 ? [[from, to]] : [[from, 10080], [0, to - 10080]];
  });
}
export function routineError(window, routine = []) {
  if (window.date && !validDate(window.date)) return 'Choose a valid date.';
  if (!window.date && (!Array.isArray(window.days) || !window.days.length)) return 'Choose at least one day.';
  if (!validWindow(window)) return 'Choose a status and different start and end times.';
  if (window.date) {
    const range = value => { const start = Date.parse(`${value.date}T00:00:00Z`) / 60000 + minutes(value.start); return [start, start + (minutes(value.end) - minutes(value.start) + 1440) % 1440]; };
    const [a, b] = range(window);
    if (routine.some(other => other.id !== window.id && other.date && validWindow(other) && (() => { const [x, y] = range(other); return a < y && x < b; })())) return 'These times overlap another availability window for that date.';
    return '';
  }
  const proposed = intervals(window);
  if (routine.filter(w => w.id !== window.id && !w.date).some(w => intervals(w).some(([a, b]) => proposed.some(([x, y]) => x < b && y > a)))) return 'That window overlaps another part of your routine. Adjust its days or times.';
  return '';
}

export function apartmentClock(now = Date.now(), timeZone = APARTMENT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
  const value = type => parts.find(p => p.type === type)?.value;
  return { day: DAYS.indexOf(value('weekday')), minute: Number(value('hour')) * 60 + Number(value('minute')) };
}
export function scheduleSegments(routine = [], day, date) {
  return routine.filter(validWindow).flatMap(window => {
    const start = minutes(window.start), end = minutes(window.end);
    if (window.date) {
      if (!date) return [];
      if (window.date === date) return [{ ...window, key: `${window.id}-dated`, startMinute: start, endMinute: end < start ? 1440 : end, continuation: false }];
      if (end < start && end > 0 && shiftDate(window.date, 1) === date) return [{ ...window, key: `${window.id}-dated-end`, startMinute: 0, endMinute: end, continuation: true }];
      return [];
    }
    if (start < end) return window.days.includes(day) ? [{ ...window, key: `${window.id}-same`, startMinute: start, endMinute: end, continuation: false }] : [];
    return [
      ...(window.days.includes(day) ? [{ ...window, key: `${window.id}-start`, startMinute: start, endMinute: 1440, continuation: false }] : []),
      ...(end > 0 && window.days.includes((day + 6) % 7) ? [{ ...window, key: `${window.id}-end`, startMinute: 0, endMinute: end, continuation: true }] : []),
    ];
  }).sort((a, b) => a.startMinute - b.startMinute);
}
export function formatMinute(value) {
  if (value === 1440) return '12:00 am';
  return formatClock(`${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`);
}
export function effectiveScheduleSegments(routine = [], day, date) {
  const segments = scheduleSegments(routine, day, date);
  const dated = segments.filter(window => window.date);
  const weekly = segments.filter(window => !window.date).flatMap(window => {
    let parts = [window];
    for (const override of dated) parts = parts.flatMap(part => {
      if (part.endMinute <= override.startMinute || part.startMinute >= override.endMinute) return [part];
      return [
        ...(part.startMinute < override.startMinute ? [{ ...part, key: `${part.key}-before-${override.id}`, endMinute: override.startMinute }] : []),
        ...(part.endMinute > override.endMinute ? [{ ...part, key: `${part.key}-after-${override.id}`, startMinute: override.endMinute }] : []),
      ];
    });
    return parts;
  });
  return [...weekly, ...dated].sort((a, b) => a.startMinute - b.startMinute);
}

export function getAvailability(person, now = Date.now(), timeZone = APARTMENT_TIME_ZONE) {
  const { day, minute } = apartmentClock(now, timeZone);
  const date = apartmentDate(now, timeZone);
  const scheduled = scheduleSegments(person.routine || [], day, date).find(window => window.date && minute >= window.startMinute && minute < window.endMinute);
  if (scheduled) return { status: scheduled.status, source: 'scheduled', label: availabilityText(scheduled.status), window: scheduled };
  // Legacy statuses without an expiry aren't evidence of current availability.
  if (AVAILABILITY_STATUSES.includes(person.status) && Number.isFinite(person.expires) && person.expires > now) {
    return { status: person.status, source: 'confirmed', label: person.status, expires: person.expires };
  }
  const window = (person.routine || []).filter(w => !w.date && validWindow(w)).find(w => {
    const start = minutes(w.start), end = minutes(w.end);
    if (start < end) return w.days.includes(day) && minute >= start && minute < end;
    return (w.days.includes(day) && minute >= start) || (w.days.includes((day + 6) % 7) && minute < end);
  });
  if (window) {
    const labels = { 'Home & free': 'Usually free', 'Leaving soon': 'Usually leaving', Studying: 'Usually studying', Away: 'Usually away' };
    return { status: window.status, source: 'usual', label: labels[window.status], window };
  }
  return { status: 'Unknown', source: 'unknown', label: 'Unknown' };
}

export function availabilityLabel(person, now = Date.now()) { return getAvailability(person, now).label; }
export function formatClock(time) {
  const value = minutes(time);
  if (value === null) return '';
  return `${Math.floor(value / 60) % 12 || 12}:${String(value % 60).padStart(2, '0')} ${value >= 720 ? 'pm' : 'am'}`;
}
export function formatExpiry(expires) {
  return new Intl.DateTimeFormat('en-US', { timeZone: APARTMENT_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(new Date(expires));
}
