/**
 * ROBUST BRANCH-WALKING VALIDATION SCRIPT
 * 
 * Paste this into the browser console AFTER the page loads completely.
 * This tests the new branch-walking locked-route system.
 */

console.clear();
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔬 ROBUST BRANCH-WALKING ROUTE TEST');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Test 1: Check all labels have locked routes
console.log('TEST 1: Route Lock Status');
console.log('─────────────────────────');
const expectedLabels = ['about', 'work', 'projects', 'contact', 'blog', 'resume', 'skills'];
const lockedIds = Object.keys(LOCKED_ROUTES);
const allLocked = expectedLabels.every(id => lockedIds.includes(id));

console.log(`Expected labels: ${expectedLabels.join(', ')}`);
console.log(`Locked labels: ${lockedIds.join(', ')}`);
console.log(`Result: ${allLocked ? '✅ ALL LOCKED' : '❌ MISSING ROUTES'}\n`);

// Test 2: Check route lengths (should be > 180px minimum)
console.log('TEST 2: Route Length Validation');
console.log('────────────────────────────────');
const MIN_ACCEPTABLE = 180; // Should be well above this with new system
let allLongEnough = true;
for (const [id, route] of Object.entries(LOCKED_ROUTES)) {
  const len = Math.round(route.len);
  const ok = len >= MIN_ACCEPTABLE;
  if (!ok) allLongEnough = false;
  console.log(`  ${id.padEnd(10)} : ${len.toString().padStart(4)}px ${ok ? '✅' : '❌ TOO SHORT'}`);
}
console.log(`\nResult: ${allLongEnough ? '✅ ALL ROUTES SUFFICIENT LENGTH' : '❌ SOME ROUTES TOO SHORT'}\n`);

// Test 3: Check speeds are configured
console.log('TEST 3: Speed Configuration');
console.log('───────────────────────────');
let allHaveSpeed = true;
for (const [id, route] of Object.entries(LOCKED_ROUTES)) {
  const ok = route.speed > 0;
  if (!ok) allHaveSpeed = false;
  console.log(`  ${id.padEnd(10)} : ${route.speed}px/s ${ok ? '✅' : '❌ NO SPEED'}`);
}
console.log(`\nResult: ${allHaveSpeed ? '✅ ALL SPEEDS CONFIGURED' : '❌ MISSING SPEEDS'}\n`);

// Test 4: Check route structure (imgPts and projPts)
console.log('TEST 4: Route Structure Validation');
console.log('───────────────────────────────────');
let allStructured = true;
for (const [id, route] of Object.entries(LOCKED_ROUTES)) {
  const hasImgPts = route.imgPts && route.imgPts.length >= 2;
  const hasProjPts = route.projPts && route.projPts.length >= 2;
  const hasCum = route.cum && route.cum.length === route.projPts?.length;
  const ok = hasImgPts && hasProjPts && hasCum;
  
  if (!ok) {
    allStructured = false;
    console.log(`  ${id.padEnd(10)} : ❌ MALFORMED`);
    console.log(`    imgPts: ${route.imgPts?.length ?? 0}, projPts: ${route.projPts?.length ?? 0}, cum: ${route.cum?.length ?? 0}`);
  } else {
    console.log(`  ${id.padEnd(10)} : ✅ imgPts=${route.imgPts.length}, projPts=${route.projPts.length}`);
  }
}
console.log(`\nResult: ${allStructured ? '✅ ALL ROUTES WELL-FORMED' : '❌ MALFORMED ROUTES'}\n`);

// Test 5: Watch motion for 5 seconds
console.log('TEST 5: Motion Observation (5 seconds)');
console.log('───────────────────────────────────────');
console.log('Recording initial positions...');
const initialPos = {};
for (const [id, route] of Object.entries(LOCKED_ROUTES)) {
  initialPos[id] = { s: route.s, left: 0, top: 0 };
  const el = document.querySelector(`[data-node="${id}"]`);
  if (el) {
    initialPos[id].left = parseFloat(el.style.left) || 0;
    initialPos[id].top = parseFloat(el.style.top) || 0;
  }
}

setTimeout(() => {
  console.log('\nMeasuring position changes after 5 seconds:');
  let allMoved = true;
  for (const [id, route] of Object.entries(LOCKED_ROUTES)) {
    const init = initialPos[id];
    const sDelta = Math.abs(route.s - init.s);
    
    const el = document.querySelector(`[data-node="${id}"]`);
    const leftDelta = el ? Math.abs((parseFloat(el.style.left) || 0) - init.left) : 0;
    const topDelta = el ? Math.abs((parseFloat(el.style.top) || 0) - init.top) : 0;
    const posDelta = Math.hypot(leftDelta, topDelta);
    
    const moved = sDelta > 1 && posDelta > 1;
    if (!moved) allMoved = false;
    
    console.log(`  ${id.padEnd(10)} : Δs=${sDelta.toFixed(1)}px, Δpos=${posDelta.toFixed(1)}px ${moved ? '✅' : '❌ STATIC'}`);
  }
  
  console.log(`\nResult: ${allMoved ? '✅ ALL LABELS MOVING' : '❌ SOME LABELS STUCK'}\n`);
  
  // Final Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 FINAL SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const allPassed = allLocked && allLongEnough && allHaveSpeed && allStructured && allMoved;
  if (allPassed) {
    console.log('✅✅✅ ALL TESTS PASSED ✅✅✅');
    console.log('\n🎉 Robust branch-walking system is working perfectly!');
    console.log('   All labels are walking along their locked branch routes.');
    console.log('   No branch-hopping, no jitter, generous travel paths.');
  } else {
    console.log('❌ SOME TESTS FAILED ❌');
    console.log('\nPlease check the failed tests above for details.');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Test 6: Current snapshot
  console.log('TEST 6: Current Route Snapshot');
  console.log('──────────────────────────────');
  for (const [id, route] of Object.entries(LOCKED_ROUTES)) {
    const progress = ((route.s / route.len) * 100).toFixed(1);
    const dir = route.dir > 0 ? '→' : '←';
    console.log(`  ${id.padEnd(10)} : ${route.s.toFixed(1)}px / ${route.len.toFixed(1)}px (${progress}%) ${dir}`);
  }
  console.log('');
  
}, 5000);

console.log('⏱️ Waiting 5 seconds to observe motion...\n');
