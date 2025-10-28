// blog-network-webgl.js — Hand-painted mycelium network
const PAL = {
  ABYSS: [0.05, 0.06, 0.07],        // soft charcoal background
  // Branch color variations (more diverse palette)
  BRANCH1: [0.25, 0.35, 0.28],      // mossy green
  BRANCH2: [0.30, 0.40, 0.45],      // blue-teal
  BRANCH3: [0.35, 0.30, 0.25],      // earthy brown
  BRANCH4: [0.28, 0.32, 0.38],      // slate gray-blue
  // Fusion colors
  FUSION1: [0.40, 0.50, 0.35],      // bright moss
  FUSION2: [0.35, 0.45, 0.50],      // aqua
  // Hub accent colors
  EMBER1: [0.70, 0.45, 0.25],       // warm orange
  EMBER2: [0.65, 0.35, 0.40],       // rose
  EMBER3: [0.55, 0.50, 0.30],       // olive gold
  // Cyst glows
  GLOW1:  [0.50, 0.60, 0.45],       // soft green
  GLOW2:  [0.45, 0.55, 0.60],       // cyan
  GLOW3:  [0.60, 0.50, 0.40],       // amber
  BONE:   [0.788, 0.761, 0.702],    // #C9C2B3
};

const DPR = Math.max(1, window.devicePixelRatio || 1);
const VIEW = { W: 1920, H: 1080 };

// ---------- GLSL (WebGL2) ----------
const VS_FSQ = `#version 300 es
precision highp float;
const vec2 P[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));
out vec2 v_uv;
void main(){
  vec2 p=P[gl_VertexID];
  v_uv = 0.5*(p+1.);
  gl_Position=vec4(p,0,1);
}`;

const FS_PAPER = `#version 300 es
precision highp float;
in vec2 v_uv; out vec4 o;
uniform vec2 uRes;        // canvas px
uniform float uTime;
uniform vec3 uAbyss;
uniform float uVignette;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
  vec2 u=f*f*(3.-2.*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
void main(){
  // abyss base
  vec3 col = uAbyss;
  // paper fibers (very subtle, static feel)
  vec2 px = v_uv * uRes * 0.33;
  float fib = smoothstep(0.65,0.9, noise(px*vec2(0.37,0.29)));
  col += vec3(0.02)*fib*0.12;
  // vignette
  vec2 c = v_uv*2.-1.;
  float r = length(c);
  float vig = smoothstep(1.2, 0.35, r); // center lighter
  col *= mix(1.0, 0.65, uVignette * (1.0 - vig));
  // mild film grain (changes twice/sec prevents swimming)
  float t = floor(uTime*2.0)*0.5;
  float g = noise(v_uv*uRes*vec2(0.9,1.1)+t);
  col *= 0.97 + g*0.03;
  o = vec4(col,1.0);
}`;

const VS_SEG = `#version 300 es
precision highp float;
// per-vertex (static quad): (u along, side)
layout(location=0) in vec2 aUS;
// per-instance
layout(location=1) in vec2 aP0;
layout(location=2) in vec2 aP1;
layout(location=3) in float aW;
layout(location=4) in float aKind;   // 0=branch,1=fusion
layout(location=5) in float aThick;  // 0..1 (relative width)
uniform vec2 uScale, uOffset, uShift; // fit + off-center
uniform vec2 uRes; // actual canvas resolution
flat out vec2 vP0;
flat out vec2 vP1;
flat out float vR;
flat out float vKind;
flat out float vThick;
void main(){
  vec2 p0 = aP0 + uShift;
  vec2 p1 = aP1 + uShift;
  vec2 dir = normalize(p1-p0 + vec2(1e-6,0.0));
  vec2 perp = vec2(-dir.y, dir.x);
  float hw = aW*0.5;
  vec2 world = mix(p0,p1,aUS.x) + perp * (aUS.y*hw);
  vec2 screen = world*uScale + uOffset;
  vec2 clip = (screen/uRes)*2.0 - 1.0;
  gl_Position = vec4(clip, 0.0, 1.0);
  vP0=p0; vP1=p1; vR=hw; vKind=aKind; vThick=aThick;
}`;

const FS_SEG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec3 uBranch1, uBranch2, uBranch3, uBranch4;
uniform vec3 uFusion1, uFusion2;
uniform vec3 uEmber1, uEmber2, uEmber3;
uniform vec2 uScale, uOffset, uShift;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uHubPos[8];
uniform int uHubCount;
uniform float uEmberR;
flat in vec2 vP0; flat in vec2 vP1; flat in float vR;
flat in float vKind; flat in float vThick;

float sdCapsule(vec2 p, vec2 a, vec2 b, float r){
  vec2 pa=p-a, ba=b-a;
  float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
  return length(pa-ba*h)-r;
}
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float hash2(vec2 p){ return fract(sin(dot(p,vec2(269.5,183.3)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1,0)), c=hash(i+vec2(0,1)), d=hash(i+vec2(1,1));
  vec2 u=f*f*(3.-2.*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}

void main(){
  vec2 pix = gl_FragCoord.xy;
  vec2 worldShifted = (pix - uOffset)/uScale;      // world coords with artistic shift applied
  vec2 world = worldShifted - uShift;              // underlying network space (no shift)

  // SDF with wrinkled edges (hand-painted feel)
  float d = sdCapsule(worldShifted, vP0, vP1, vR);
  
  // Add organic wrinkles/irregularity to edge
  // Scale wrinkle by segment radius AND scale to keep it stable at all zoom levels
  float wrinkle = noise(world * 0.3) * 0.8 + noise(world * 0.8) * 0.4;
  float scaleAvg = (uScale.x + uScale.y) * 0.5; // average scale
  float wrinkleAmount = min(vR * 0.12, 0.6) * max(0.3, scaleAvg);
  d += (wrinkle - 0.5) * wrinkleAmount;
  
  float aa = max(fwidth(d), 1e-4);
  float alpha = 1.0 - smoothstep(-aa*2.0, aa*0.5, d); // softer falloff

  // Color variation based on position (hand-painted variety)
  float colorVar = hash(vP0 * 0.1); // per-segment variation
  float localNoise = noise(world * 0.15); // texture within segment
  
  vec3 col;
  if(vKind > 0.5) {
    // Fusions: alternate between two fusion colors
    col = mix(uFusion1, uFusion2, step(0.5, colorVar));
  } else {
    // Branches: pick from 4 colors based on hash
    if(colorVar < 0.25) col = uBranch1;
    else if(colorVar < 0.5) col = uBranch2;
    else if(colorVar < 0.75) col = uBranch3;
    else col = uBranch4;
  }
  
  // Add painterly texture variation
  col *= 0.85 + localNoise * 0.3; // texture modulation
  
  // Color variation along the segment (brush stroke effect)
  vec2 segDir = normalize(vP1 - vP0);
  float along = dot(worldShifted - vP0, segDir) / max(0.1, length(vP1 - vP0));
  float strokeVar = noise(vec2(along * 10.0, colorVar * 100.0)) * 0.15;
  col *= 1.0 + strokeVar;

  // Hub ember highlights (multi-color)
  float minHub = 1e9;
  int nearestHub = 0;
  for(int i=0;i<8;i++){
    if(i>=uHubCount) break;
    vec2 h = uHubPos[i];
  float dist2 = dot(world-h, world-h);
    if(dist2<minHub) { minHub = dist2; nearestHub = i; }
  }
  float nearHub = smoothstep(uEmberR*uEmberR, 0.0, minHub);
  float thickOK = step(0.7, vThick);
  
  // Pick ember color based on hub index
  vec3 emberCol;
  int hubMod = nearestHub % 3;
  if(hubMod == 0) emberCol = uEmber1;
  else if(hubMod == 1) emberCol = uEmber2;
  else emberCol = uEmber3;
  
  col = mix(col, emberCol, nearHub * thickOK * 0.75);

  // Soft painted glow
  float glow = smoothstep(3.5, 0.0, d) * 0.2;
  col += col * glow;

  o = vec4(clamp(col, 0.0, 1.0), alpha * 0.95);
}`;

const VS_CYST = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQuad;
layout(location=1) in vec2 aPos;
layout(location=2) in float aSize;
layout(location=3) in float aPulse;
uniform vec2 uScale, uOffset, uShift;
uniform vec2 uRes;
uniform float uTime;
out vec2 vUv;
out float vPulsePhase;
void main(){
  float pulse = (sin(uTime*0.8 + aPulse)*0.3 + 0.7);
  float r = aSize * pulse;
  vec2 world = aPos + uShift + aQuad * r * 3.0;
  vec2 screen = world*uScale + uOffset;
  vec2 clip = (screen/uRes)*2.0 - 1.0;
  gl_Position = vec4(clip,0,1);
  vUv = aQuad*0.5 + 0.5;
  vPulsePhase = aPulse; // pass to fragment for color variation
}`;

const FS_CYST = `#version 300 es
precision highp float;
in vec2 vUv;
in float vPulsePhase;
out vec4 o;
uniform vec3 uGlow1, uGlow2, uGlow3;
uniform vec3 uBranch1;
float hash(float p){ return fract(sin(p*127.1)*43758.5453); }
void main(){
  float d = length(vUv-0.5);
  float a = smoothstep(0.6, 0.0, d);
  
  // Pick color based on pulse phase
  float cVar = hash(vPulsePhase);
  vec3 glowCol;
  if(cVar < 0.33) glowCol = uGlow1;
  else if(cVar < 0.66) glowCol = uGlow2;
  else glowCol = uGlow3;
  
  vec3 col = mix(uBranch1, glowCol, 0.7) * (0.5 + (1.0 - d)*0.4);
  o = vec4(col, a*0.7);
}`;

// ---------- utils ----------
const q = (sel)=>document.querySelector(sel);
function compile(gl, type, src){
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){ throw new Error(gl.getShaderInfoLog(sh)); }
  return sh;
}
function program(gl, vs, fs){
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)){ throw new Error(gl.getProgramInfoLog(p)); }
  return p;
}

// ---------- main ----------
let initialized = false;
let animationActive = false;

async function initBlogNetwork(){
  if (initialized) return; // Only init once
  
  console.log('[Blog Network WebGL] Script loaded, starting init...');
  const canvas = q('#blog-network-canvas');
  console.log('[Blog Network WebGL] Canvas element:', canvas);
  if (!canvas) {
    console.error('[Blog Network WebGL] Canvas element not found!');
    return;
  }
  const gl = canvas.getContext('webgl2', { alpha:false, antialias:false, preserveDrawingBuffer:false, powerPreference:'high-performance' });
  console.log('[Blog Network WebGL] WebGL2 context:', gl);
  if(!gl){ console.error('WebGL2 not available'); return; }

  // Load network JSON
  console.log('[Blog Network WebGL] Fetching network data...');
  const res = await fetch('./artifacts/blog_network.json');
  console.log('[Blog Network WebGL] Fetch response:', res.status, res.ok);
  const data = await res.json();
  console.log('[Blog Network WebGL] Loaded network:', {
    paths: data.paths?.length,
    hubs: data.hubs?.length,
    firstPath: data.paths?.[0]?.slice(0, 2)
  });

  // Build geometry buffers (segments)
  const segs = [];
  const MAXW = 4.5, MINW = 0.9;
  (data.paths||[]).forEach((p, i)=>{
    if(p.length<2) return;
    const meta = (data.paths_meta&&data.paths_meta[i])||{};
    const kind = meta.kind==='fusion'?1:0;
    const depth = meta.depth||0;
    const base = Math.max(MINW, MAXW - 0.5*depth);
    for(let j=0;j<p.length-1;j++){
      const [x1,y1] = p[j], [x2,y2] = p[j+1];
      const prog = j/(p.length-1);
      const w = base*(1.0 - 0.4*prog);
      const thickRatio = Math.min(1.0, w/MAXW);
      segs.push(x1,y1,x2,y2,w, kind, thickRatio);
    }
  });
  const segCount = segs.length/7;
  console.log('[Blog Network WebGL] Built geometry:', {
    segments: segCount,
    firstSeg: segs.slice(0, 7),
    totalFloats: segs.length
  });

  // infected/cyst nodes (every 12th)
  const cysts = [];
  const interval = 12;
  (data.paths||[]).forEach((p)=>{
    for(let i=interval;i<p.length-interval;i+=interval){
      const [x,y] = p[i];
      cysts.push(x,y, 2.5, Math.random()*6.2831);
    }
  });
  const cystCount = cysts.length/4;

  // Prepare buffers/VAOs
  function makeVAOforSegments(){
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    // quad
    const quad = new Float32Array([0,-1, 0,1, 1,-1, 1,1]); // triangle strip
    const bQuad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bQuad);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // instances
    const inst = new Float32Array(segs);
    const bInst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bInst);
    gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
    const STRIDE = 7*4; // 7 floats
    // aP0
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 0);
    gl.vertexAttribDivisor(1, 1);
    // aP1
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE, 8);
    gl.vertexAttribDivisor(2, 1);
    // aW
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, STRIDE, 16);
    gl.vertexAttribDivisor(3, 1);
    // aKind
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, STRIDE, 20);
    gl.vertexAttribDivisor(4, 1);
    // aThick
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 1, gl.FLOAT, false, STRIDE, 24);
    gl.vertexAttribDivisor(5, 1);
    gl.bindVertexArray(null);
    return { vao, count: segCount };
  }
  function makeVAOforCysts(){
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    // quad
    const quad = new Float32Array([-1,-1, -1,1, 1,-1, 1,1]);
    const bQuad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bQuad);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    // instances: pos,size,pulse
    const inst = new Float32Array(cysts);
    const bInst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bInst);
    gl.bufferData(gl.ARRAY_BUFFER, inst, gl.DYNAMIC_DRAW);
    const STR = 4*4; // x,y,size,pulse
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,2,gl.FLOAT,false,STR,0); gl.vertexAttribDivisor(1,1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,1,gl.FLOAT,false,STR,8); gl.vertexAttribDivisor(2,1);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,1,gl.FLOAT,false,STR,12); gl.vertexAttribDivisor(3,1);
    gl.bindVertexArray(null);
    return { vao, count: cystCount, buf: bInst, data: inst };
  }

  const progPaper = program(gl, VS_FSQ, FS_PAPER);
  const progSeg   = program(gl, VS_SEG, FS_SEG);
  const progCyst  = program(gl, VS_CYST, FS_CYST);
  console.log('[Blog Network WebGL] Shaders compiled:', { progPaper, progSeg, progCyst });

  const vaoSeg  = makeVAOforSegments();
  const vaoCyst = makeVAOforCysts();
  console.log('[Blog Network WebGL] VAOs created:', { vaoSeg, vaoCyst });

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.disable(gl.DEPTH_TEST);

  // uniforms helpers
  function set2(p,name,x,y){ const l=gl.getUniformLocation(p,name); gl.uniform2f(l,x,y); }
  function set3(p,name,[r,g,b]){ const l=gl.getUniformLocation(p,name); gl.uniform3f(l,r,g,b); }

  // hubs → uniform array
  const hubPos = (data.hubs||[]).map(h=>[h.x, h.y]);
  function setHubs(p){
    const loc = gl.getUniformLocation(p, 'uHubPos[0]');
    const flat = new Float32Array(16);
    hubPos.forEach((h,i)=>{ flat[i*2]=h[0]; flat[i*2+1]=h[1]; });
    gl.uniform2fv(loc, flat);
    gl.uniform1i(gl.getUniformLocation(p,'uHubCount'), hubPos.length);
  }

  // transforms (fit 1920x1080)
  const shift = [-40, 18];
  let resizeTimeout = null;
  function resize(){
    const dpr = DPR;
    
    // Get actual canvas client dimensions
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(300, rect.width); // minimum size to prevent tiny scales
    const cssH = Math.max(300, rect.height);
    
    const w = Math.max(1, (cssW * dpr) | 0);
    const h = Math.max(1, (cssH * dpr) | 0);
    
    // Only resize if dimensions changed significantly (>5px)
    if (Math.abs(canvas.width - w) > 5 || Math.abs(canvas.height - h) > 5) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      console.log('[Blog Network WebGL] Canvas resized:', {
        cssSize: `${cssW}x${cssH}`,
        bufferSize: `${w}x${h}`,
        dpr: dpr
      });
    }
    
    // scale & offset to fit 1920x1080
    const scale = Math.min(cssW/VIEW.W, cssH/VIEW.H);
    const offX = (cssW - VIEW.W*scale)/2;
    const offY = (cssH - VIEW.H*scale)/2;
    
    return { scale, offX, offY, cssW, cssH };
  }
  let fit = resize();
  
  // Debounced resize handler to prevent rapid resizing
  window.addEventListener('resize', ()=>{ 
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      fit = resize();
      console.log('[Blog Network WebGL] Resize stabilized:', {
        scale: fit.scale.toFixed(4),
        size: `${fit.cssW}x${fit.cssH}`
      });
    }, 100); // Wait 100ms after last resize event
  });
  console.log('[Blog Network WebGL] Canvas setup:', {
    canvasSize: `${canvas.width}x${canvas.height}`,
    cssSize: `${fit.cssW}x${fit.cssH}`,
    scale: fit.scale,
    offset: [fit.offX, fit.offY],
    shift
  });

  let hoveredHubId = null;
  // simple hover picking in data space (same as your canvas version)
  canvas.addEventListener('mousemove', (e)=>{
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX-rect.left - fit.offX)/fit.scale - shift[0];
    const my = (e.clientY-rect.top  - fit.offY)/fit.scale - shift[1];
    hoveredHubId = null;
    let minD = 99999, idx=-1;
    for(let i=0;i<hubPos.length;i++){
      const dx = mx-hubPos[i][0], dy = my-hubPos[i][1];
      const d = Math.hypot(dx,dy);
      if(d<50 && d<minD){ minD=d; idx=i; }
    }
    hoveredHubId = idx>=0 ? (data.hubs[idx].id) : null;
    canvas.style.cursor = hoveredHubId ? 'pointer' : 'default';
  });

  // animate
  let last = performance.now();
  let frameCount = 0;
  console.log('[Blog Network WebGL] Starting animation loop...');
  function loop(now){
    const dt = now-last; if(dt<1000/30){ requestAnimationFrame(loop); return; } // 30 FPS cap
    last = now;
    
    // Debug: Log first 3 frames to verify rendering
    if (frameCount < 3) {
      console.log(`[Blog Network WebGL] Frame ${frameCount}: rendering`, {
        canvasSize: `${canvas.width}x${canvas.height}`,
        viewport: `${fit.cssW}x${fit.cssH}`,
        scale: fit.scale,
        segmentCount: vaoSeg.count,
        cystCount: vaoCyst.count
      });
    }
    frameCount++;

    // PAPER (renders background)
    gl.useProgram(progPaper);
    gl.bindVertexArray(null);
    gl.uniform2f(gl.getUniformLocation(progPaper,'uRes'), fit.cssW, fit.cssH);
    gl.uniform1f(gl.getUniformLocation(progPaper,'uTime'), now*0.001);
    set3(progPaper,'uAbyss', PAL.ABYSS);
    gl.uniform1f(gl.getUniformLocation(progPaper,'uVignette'), 0.35);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // SEGMENTS
    gl.useProgram(progSeg);
    set2(progSeg,'uScale', fit.scale, fit.scale);
    set2(progSeg,'uOffset', fit.offX, fit.offY);
    set2(progSeg,'uShift', shift[0], shift[1]);
    set2(progSeg,'uRes', fit.cssW, fit.cssH);
    gl.uniform1f(gl.getUniformLocation(progSeg,'uTime'), now*0.001);
    // Set all branch colors
    set3(progSeg,'uBranch1', PAL.BRANCH1);
    set3(progSeg,'uBranch2', PAL.BRANCH2);
    set3(progSeg,'uBranch3', PAL.BRANCH3);
    set3(progSeg,'uBranch4', PAL.BRANCH4);
    // Set fusion colors
    set3(progSeg,'uFusion1', PAL.FUSION1);
    set3(progSeg,'uFusion2', PAL.FUSION2);
    // Set ember colors
    set3(progSeg,'uEmber1', PAL.EMBER1);
    set3(progSeg,'uEmber2', PAL.EMBER2);
    set3(progSeg,'uEmber3', PAL.EMBER3);
    gl.uniform1f(gl.getUniformLocation(progSeg,'uEmberR'), 86.0);
    setHubs(progSeg);
    gl.bindVertexArray(vaoSeg.vao);
    
    // DEBUG: Log segment draw call on first frame
    if (frameCount === 1) {
      console.log('[Blog Network WebGL] Drawing segments:', {
        instanceCount: vaoSeg.count,
        scale: fit.scale,
        offset: [fit.offX, fit.offY],
        shift: shift
      });
    }
    
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, vaoSeg.count);
    gl.bindVertexArray(null);

    // CYSTS
    gl.useProgram(progCyst);
    set2(progCyst,'uScale', fit.scale, fit.scale);
    set2(progCyst,'uOffset', fit.offX, fit.offY);
    set2(progCyst,'uShift', shift[0], shift[1]);
    set2(progCyst,'uRes', fit.cssW, fit.cssH);
    gl.uniform1f(gl.getUniformLocation(progCyst,'uTime'), now*0.001);
    set3(progCyst,'uGlow1', PAL.GLOW1);
    set3(progCyst,'uGlow2', PAL.GLOW2);
    set3(progCyst,'uGlow3', PAL.GLOW3);
    set3(progCyst,'uBranch1', PAL.BRANCH1);
    gl.bindVertexArray(vaoCyst.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, vaoCyst.count);
    gl.bindVertexArray(null);

    // Hover halo (breathing ember) — simple overdraw using cyst shader idea
    if(hoveredHubId){
      const hub = data.hubs.find(h=>h.id===hoveredHubId);
      if(hub){
        gl.useProgram(progCyst);
        set2(progCyst,'uScale', fit.scale, fit.scale);
        set2(progCyst,'uOffset', fit.offX, fit.offY);
        set2(progCyst,'uShift', shift[0], shift[1]);
        gl.uniform1f(gl.getUniformLocation(progCyst,'uTime'), now*0.001);
        set3(progCyst,'uGlow1', PAL.EMBER1);
        set3(progCyst,'uGlow2', PAL.EMBER2);
        set3(progCyst,'uGlow3', PAL.EMBER3);
        set3(progCyst,'uBranch1', PAL.BRANCH1);
        // draw one big pulse at hub
        const pulse = (Math.sin(now*0.0005)*0.2+0.8);
        const r = 20 + 44*pulse;
        // quick immediate-mode instancing (no buffer update): use viewport trick
        // simpler: draw a triangle strip with gl_VertexID FSQ but centered—reuse cyst VAO first instance by updating buffer
        vaoCyst.data.set([hub.x, hub.y, 10.0, 0.0], 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, vaoCyst.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, vaoCyst.data.subarray(0,4));
        gl.bindVertexArray(vaoCyst.vao);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, 1);
        gl.bindVertexArray(null);
      }
    }

    requestAnimationFrame(loop);
  }
  
  initialized = true;
  console.log('[Blog Network WebGL] Initialization complete!');
  
  // Start animation loop
  animationActive = true;
  requestAnimationFrame(loop);
}

// Wait for DOM to be ready, then init when blog section becomes visible
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Blog Network WebGL] DOM loaded, waiting for blog section...');
    watchForBlogSection();
  });
} else {
  console.log('[Blog Network WebGL] DOM already loaded, watching for blog section...');
  watchForBlogSection();
}

function watchForBlogSection() {
  const blogSection = document.getElementById('blog');
  if (!blogSection) {
    console.error('[Blog Network WebGL] Blog section not found!');
    return;
  }
  
  // Check if already visible
  if (blogSection.classList.contains('active-section')) {
    console.log('[Blog Network WebGL] Blog section already visible, initializing...');
    initBlogNetwork();
    return;
  }
  
  // Watch for visibility changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        if (blogSection.classList.contains('active-section')) {
          console.log('[Blog Network WebGL] Blog section became visible, initializing...');
          initBlogNetwork();
          observer.disconnect(); // Stop watching after init
        }
      }
    });
  });
  
  observer.observe(blogSection, {
    attributes: true,
    attributeFilter: ['class']
  });
  
  console.log('[Blog Network WebGL] Watching for blog section to become visible...');
}
