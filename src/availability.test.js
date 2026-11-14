import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailability, routineError, apartmentClock, scheduleSegments } from './availability.js';

test('schedule rows split overnight windows across the selected days', () => {
  const overnight = { id: 'night', days: [6], start: '22:00', end: '02:00', status: 'Studying' };
  const saturday = scheduleSegments([overnight], 6);
  assert.equal(saturday[0].startMinute, 1320);
  assert.equal(saturday[0].endMinute, 1440);
  const sunday = scheduleSegments([overnight], 0);
  assert.equal(sunday[0].startMinute, 0);
  assert.equal(sunday[0].endMinute, 120);
  assert.equal(sunday[0].continuation, true);
  assert.equal(scheduleSegments([overnight], 1).length, 0);
  assert.equal(scheduleSegments([{ ...overnight, end: '00:00' }], 0).length, 0);
});

const monday = Date.parse('2026-11-02T18:00:00Z'); // Monday, 1 pm in New York.
const window = { id: 'usual', days: [1], start: '12:00', end: '15:00', status: 'Home & free' };

test('a matching recurring window is usual availability, with an exclusive end', () => {
  const person = { routine: [window] };
  assert.equal(getAvailability(person, monday).source, 'usual');
  assert.equal(getAvailability(person, monday).label, 'Usually free');
  assert.equal(getAvailability(person, Date.parse('2026-11-02T17:00:00Z')).source, 'usual');
  assert.equal(getAvailability(person, Date.parse('2026-11-02T20:00:00Z')).source, 'unknown');
  assert.equal(getAvailability(person, Date.parse('2026-11-03T18:00:00Z')).source, 'unknown');
});

test('confirmed overrides win, then expiry returns to a matching routine', () => {
  const person = { status: 'Studying', expires: monday + 1000, routine: [window] };
  assert.equal(getAvailability(person, monday).source, 'confirmed');
  assert.equal(getAvailability(person, monday).status, 'Studying');
  assert.equal(getAvailability(person, monday + 1000).source, 'usual');
  assert.equal(getAvailability(person, monday + 1000).status, 'Home & free');
});

test('outside a routine or after an override with no routine the status is unknown', () => {
  assert.equal(getAvailability({}, monday).status, 'Unknown');
  assert.equal(getAvailability({ status: 'Away', expires: monday }, monday).status, 'Unknown');
  assert.equal(getAvailability({ status: 'Home & free', expires: null }, monday).source, 'unknown');
});

test('overnight windows continue from Saturday into Sunday', () => {
  const person = { routine: [{ ...window, days: [6], start: '22:00', end: '02:00' }] };
  assert.equal(getAvailability(person, Date.parse('2026-11-01T05:30:00Z')).source, 'usual');
  assert.equal(getAvailability(person, Date.parse('2026-11-01T07:00:00Z')).source, 'unknown');
});

test('weekly windows follow apartment wall time through daylight saving changes', () => {
  assert.deepEqual(apartmentClock(Date.parse('2026-11-01T05:30:00Z')), { day: 0, minute: 90 });
  assert.deepEqual(apartmentClock(Date.parse('2026-11-01T06:30:00Z')), { day: 0, minute: 90 });
  const person = { routine: [{ ...window, days: [0], start: '01:00', end: '02:00' }] };
  assert.equal(getAvailability(person, Date.parse('2026-11-01T05:30:00Z')).source, 'usual');
  assert.equal(getAvailability(person, Date.parse('2026-11-01T06:30:00Z')).source, 'usual');
});

test('overlaps are rejected, adjacent windows and editing a window are allowed', () => {
  assert.match(routineError({ ...window, id: 'new', start: '14:00' }, [window]), /overlaps/);
  assert.equal(routineError({ ...window, id: 'new', start: '15:00', end: '17:00' }, [window]), '');
  assert.equal(routineError({ ...window, end: '16:00' }, [window]), '');
  const overnight = { ...window, id: 'night', days: [6], start: '22:00', end: '02:00' };
  assert.match(routineError({ ...window, days: [0], start: '01:00', end: '03:00' }, [overnight]), /overlaps/);
});

test('missing days, equal times, malformed times and invalid days are rejected', () => {
  assert.match(routineError({ ...window, days: [] }), /day/);
  assert.ok(routineError({ ...window, start: '12:00', end: '12:00' }));
  assert.ok(routineError({ ...window, end: '25:00' }));
  assert.ok(routineError({ ...window, days: [8] }));
  assert.equal(getAvailability({ routine: [{ ...window, start: 'bad' }] }, monday).source, 'unknown');
});

test('legacy saved layouts preserve future overrides and expired statuses do not become confirmed', () => {
  assert.equal(getAvailability({ status: 'Leaving soon', expires: monday + 3600000 }, monday).source, 'confirmed');
  assert.equal(getAvailability({ status: 'Leaving soon', expires: monday - 1 }, monday).source, 'unknown');
});

test('dated windows apply only at their exact start/end and do not repeat the next week', async () => {
  const { canReceiveTask } = await import('./availability.js');
  const person = { routine: [{ id: 'date-busy', date: '2026-11-02', days: [1], start: '13:00', end: '15:00', status: 'Studying' }] };
  assert.equal(getAvailability(person, Date.parse('2026-11-02T17:59:00Z')).source, 'unknown');
  assert.equal(getAvailability(person, monday).source, 'scheduled');
  assert.equal(canReceiveTask(person, monday), false);
  assert.equal(canReceiveTask(person, Date.parse('2026-11-02T20:00:00Z')), true);
  assert.equal(getAvailability(person, Date.parse('2026-11-09T18:00:00Z')).source, 'unknown');
});

test('dated busy exceptions override weekly free time, including their display segments', async () => {
  const { effectiveScheduleSegments } = await import('./availability.js');
  const person = { routine: [{ ...window, end: '16:00' }, { id: 'exception', date: '2026-11-02', start: '13:00', end: '15:00', status: 'Away' }] };
  assert.equal(getAvailability(person, monday).status, 'Away');
  assert.equal(getAvailability(person, Date.parse('2026-11-02T20:00:00Z')).status, 'Home & free');
  assert.deepEqual(effectiveScheduleSegments(person.routine, 1, '2026-11-02').map(segment => [segment.status, segment.startMinute, segment.endMinute]), [['Home & free', 720, 780], ['Away', 780, 900], ['Home & free', 900, 960]]);
});

test('dated overnight windows and overlap validation use apartment dates', () => {
  const night = { id: 'night', date: '2026-11-02', start: '23:00', end: '01:00', status: 'Studying' };
  assert.equal(getAvailability({ routine: [night] }, Date.parse('2026-11-03T05:30:00Z')).status, 'Studying');
  assert.equal(getAvailability({ routine: [night] }, Date.parse('2026-11-03T06:00:00Z')).status, 'Unknown');
  assert.match(routineError({ id: 'other', date: '2026-11-03', start: '00:30', end: '02:00', status: 'Home & free' }, [night]), /overlap/);
  assert.equal(routineError({ id: 'other', date: '2026-11-03', start: '01:00', end: '02:00', status: 'Home & free' }, [night]), '');
  assert.match(routineError({ ...night, date: '2026-02-30' }), /valid date/);
});

test('free, leaving and unknown allow drops while busy legacy and weekly statuses block them', async () => {
  const { canReceiveTask } = await import('./availability.js');
  assert.equal(canReceiveTask({}, monday), true);
  assert.equal(canReceiveTask(undefined, monday), false);
  for (const status of ['Home & free', 'Leaving soon', 'Studying', 'Away']) {
    const expected = ['Home & free', 'Leaving soon'].includes(status);
    assert.equal(canReceiveTask({ status, expires: monday + 1000 }, monday), expected);
    assert.equal(canReceiveTask({ routine: [{ ...window, status }] }, monday), expected);
  }
});
