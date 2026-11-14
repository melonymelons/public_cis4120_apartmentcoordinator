import { CHARACTERS } from './characters.js';

export const AVATAR_COLORS = [
  { name: 'Sand', value: '#e7c38b', legacy: '#eddcc8' },
  { name: 'Sage', value: '#b6cf9b', legacy: '#e1e7d3' },
  { name: 'Lavender', value: '#c5b1e3', legacy: '#e3dcf0' },
  { name: 'Blue', value: '#a7cfe8', legacy: '#dbe8ee' },
  { name: 'Rose', value: '#e9a8be', legacy: '#f0dde1' },
  { name: 'Peach', value: '#f0b48e', legacy: '#f3dfcb' },
];
export function profileFields(name, color) {
  const trimmed = name.trim();
  return { name: trimmed, color, initial: Array.from(trimmed)[0]?.toUpperCase() || '?' };
}
export function updateOwnProfile(state, personId, fields) {
  if (personId !== state.currentUser || !state.people.some(person => person.id === personId)) return state;
  if (!fields || typeof fields.name !== 'string' || !fields.name.trim() || fields.name.trim().length > 40) return state;
  const update = person => {
    if (person.id !== personId) return person;
    const color = AVATAR_COLORS.some(option => (option.value === fields.color || option.legacy === fields.color)) ? fields.color : person.color;
    const character = fields.character === null || CHARACTERS.some(option => option.id === fields.character) ? fields.character : person.character;
    // Only profile appearance fields may change through this operation.
    return { ...person, ...profileFields(fields.name, color), character };
  };
  return { ...state, people: state.people.map(update), ...(state.households ? { households: state.households.map(household => ({ ...household, people: household.people.map(update) })) } : {}) };
}

const ORIGINAL_HOUSEHOLD = 'household-original';
const HOUSEHOLD_FIELDS = ['apartment', 'people', 'rooms', 'objects', 'tasks', 'inventory', 'canvas', 'formerPeople', 'revision'];

// Keep the active apartment at the root for existing screens and legacy saves.
// Archived apartments in older saves are preserved, but are no longer selectable.
export function householdList(state) {
  if (state.cloud && !state.householdId) return [];
  const id = state.householdId || ORIGINAL_HOUSEHOLD;
  const current = { id, ...Object.fromEntries(HOUSEHOLD_FIELDS.map(key => [key, state[key]])) };
  return [current];
}


function activateHousehold(state, target, households) {
  return { ...state, ...Object.fromEntries(HOUSEHOLD_FIELDS.map(key => [key, target[key]])), householdId: target.id, households };
}

export function createHousehold(state, name, id) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 45 || !id) return state;
  const households = householdList(state);
  const me = state.people.find(person => person.id === state.currentUser);
  if (!me || households.some(household => household.people.some(person => person.id === state.currentUser))) return state;
  const household = {
    id, apartment: name.trim(), people: [{ ...me, status: null, expires: null, routine: [] }],
    rooms: [], objects: [], tasks: [], inventory: [], formerPeople: [], canvas: { cols: 12, rows: 14 },
  };
  return activateHousehold(state, household, [...households, household]);
}

export function removeRoommate(state, id) {
  const person = state.people.find(p => p.id === id);
  if (!person || id === state.currentUser) return state;
  return {
    ...state,
    people: state.people.filter(p => p.id !== id),
    formerPeople: [...(state.formerPeople || []).filter(p => p.id !== id), { id: person.id, name: person.name }],
    tasks: state.tasks.map(task => task.status !== 'done' && (task.to === id || (task.status === 'pending' && task.from === id)) ? { ...task, status: 'open', to: null } : task),
    inventory: state.inventory.map(item => item.buyerId === id ? { ...item, buyerId: null } : item),
  };
}
