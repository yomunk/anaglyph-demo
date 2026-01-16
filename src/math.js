// Convert full-plate UV (0..1 across whole plate) to half-UV (0..1 within the selected half)
export function fullUVToHalfUV(uFull, vFull) {
  const isLeft = uFull < 0.5;
  const uHalf = isLeft ? (uFull / 0.5) : ((uFull - 0.5) / 0.5);
  return { isLeft, u: uHalf, v: vFull };
}

// Convert half-UV back to full plate UV for drawing overlays
export function halfUVToFullUV(isLeft, uHalf, vHalf) {
  const uFull = isLeft ? (uHalf * 0.5) : (0.5 + uHalf * 0.5);
  return { u: uFull, v: vHalf };
}

export function computeThetaFromPicks(picks) {
  const L_inf = picks.L_inf;
  const R_inf = picks.R_inf;
  const L_fg  = picks.L_fg;
  const R_fg  = picks.R_fg;

  if (!L_inf || !R_inf || !L_fg || !R_fg) return 0;

  const aL = Math.atan2(L_fg.v - L_inf.v, L_fg.u - L_inf.u);
  const aR = Math.atan2(R_fg.v - R_inf.v, R_fg.u - R_inf.u);

  // Rotate RIGHT by +theta to match LEFT
  let theta = aL - aR;

  // Optional: wrap to [-pi, pi] for stability/readability
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;

  return theta;
}
