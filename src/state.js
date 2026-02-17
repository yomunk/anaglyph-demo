export const PICK_ORDER = ['L_stat', 'R_stat'];

export function createState() {
  return {
    picks: { L_stat: null, R_stat: null },
  };
}

export function nextPickName(state) {
  for (const k of PICK_ORDER) if (!state.picks[k]) return k;
  return null;
}

export function allPicksDone(state) {
  return PICK_ORDER.every(k => !!state.picks[k]);
}

export function resetPicks(state) {
  for (const k of PICK_ORDER) state.picks[k] = null;
}
