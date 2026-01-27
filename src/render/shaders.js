export const VERT_FULLSCREEN = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const FRAG_ANAGLYPH = /* glsl */`
  precision highp float;

  uniform sampler2D uTex;
  uniform vec2  uLInf;
  uniform vec2  uRInf;

  varying vec2 vUv;

  vec2 halfToPlateUV_L(vec2 uvHalf) { return vec2(uvHalf.x * 0.5, uvHalf.y); }
  vec2 halfToPlateUV_R(vec2 uvHalf) { return vec2(0.5 + uvHalf.x * 0.5, uvHalf.y); }
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

  void main() {
    vec2 A = vec2(0.5, 0.5);     // where "infinity" should land in the output
    vec2 p = vUv - A;            // output coords relative to anchor

    // LEFT: ensure vUv==A samples exactly at uLInf
    vec2 uvL = p + uLInf;

    // RIGHT: undo rotation in output space, then sample around uRInf
    vec2 uvR = p + uRInf;

    // Clamp to avoid sampling outside
    uvL = clamp(uvL, 0.0, 1.0);
    uvR = clamp(uvR, 0.0, 1.0);

    vec3 colL = texture2D(uTex, halfToPlateUV_L(uvL)).rgb;
    vec3 colR = texture2D(uTex, halfToPlateUV_R(uvR)).rgb;

    float gL = clamp(luma(colL), 0.0, 1.0);
    float gR = clamp(luma(colR), 0.0, 1.0);

    gl_FragColor = vec4(gL, gR, gR, 1.0);
  }
`;

export const FRAG_WIGGLE = /* glsl */`
  precision highp float;

  uniform sampler2D uTex;
  uniform vec2  uLInf;
  uniform vec2  uRInf;

  uniform float uTime;      // seconds
  uniform float uWiggleHz;  // flips per second
  uniform float uWiggleBlend; // 0 = hard switch, 1 = crossfade (optional)

  varying vec2 vUv;

  vec2 halfToPlateUV_L(vec2 uvHalf) { return vec2(uvHalf.x * 0.5, uvHalf.y); }
  vec2 halfToPlateUV_R(vec2 uvHalf) { return vec2(0.5 + uvHalf.x * 0.5, uvHalf.y); }

  void main() {
    vec2 A = vec2(0.5, 0.5);
    vec2 p = vUv - A;

    // Aligned sample coords
    vec2 uvL = clamp(p + uLInf, 0.0, 1.0);

    vec2 uvR = clamp(p + uRInf, 0.0, 1.0);

    vec3 colL = texture2D(uTex, halfToPlateUV_L(uvL)).rgb;
    vec3 colR = texture2D(uTex, halfToPlateUV_R(uvR)).rgb;

    // Phase in [0,1)
    float phase = fract(uTime * uWiggleHz);

    // Hard switch by default
    float sel = step(0.5, phase); // 0 for first half-cycle, 1 for second

    // Optional: crossfade near the boundary to reduce flicker
    if (uWiggleBlend > 0.0) {
      float t = smoothstep(0.5 - 0.08, 0.5 + 0.08, phase);
      colL = mix(colL, colR, t);
      gl_FragColor = vec4(colL, 1.0);
    } else {
      vec3 col = mix(colL, colR, sel);
      gl_FragColor = vec4(col, 1.0);
    }
  }
`;

