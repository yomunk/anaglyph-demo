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
