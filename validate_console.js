// ━━━ LOCKED-ROUTE VALIDATION SCRIPT ━━━
// Paste this into browser console after page loads

console.log('=== LOCKED-ROUTE VALIDATION ===\n');

// 1. Check all routes are locked
const lockedIds = Object.keys(LOCKED_ROUTES);
console.log('1. Locked routes:', lockedIds);
console.log(`   Expected: 7 labels (about, work, projects, contact, blog, resume, skills)`);
console.log(`   Result: ${lockedIds.length === 7 ? '✅ PASS' : '❌ FAIL - only ' + lockedIds.length + ' locked'}\n`);

// 2. Check all route lengths > MIN_ROUTE_LEN
console.log('2. Route lengths (should all be > 180px):');
let allLongEnough = true;
Object.entries(LOCKED_ROUTES).forEach(([id, route]) => {
  const ok = route.len >= 180;
  allLongEnough = allLongEnough && ok;
  console.log(`   ${id}: ${route.len.toFixed(1)}px ${ok ? '✅' : '❌ TOO SHORT'}`);
});
console.log(`   Result: ${allLongEnough ? '✅ PASS' : '❌ FAIL - some routes too short'}\n`);

// 3. Check all speeds are non-zero
console.log('3. Speeds (should all be > 0):');
let allHaveSpeed = true;
Object.entries(LOCKED_ROUTES).forEach(([id, route]) => {
  const ok = route.speed > 0;
  allHaveSpeed = allHaveSpeed && ok;
  console.log(`   ${id}: ${route.speed}px/s ${ok ? '✅' : '❌ ZERO SPEED'}`);
});
console.log(`   Result: ${allHaveSpeed ? '✅ PASS' : '❌ FAIL - some labels have zero speed'}\n`);

// 4. Watch motion for 5 seconds
console.log('4. Testing motion (wait 5 seconds)...');
const prevS = {};
Object.keys(LOCKED_ROUTES).forEach(id => prevS[id] = LOCKED_ROUTES[id].s);

setTimeout(() => {
  console.log('   Motion deltas:');
  let allMoved = true;
  Object.keys(LOCKED_ROUTES).forEach(id => {
    const route = LOCKED_ROUTES[id];
    const delta = Math.abs(route.s - prevS[id]);
    const ok = delta > 1;
    allMoved = allMoved && ok;
    console.log(`   ${id}: ${delta.toFixed(1)}px ${ok ? '✅ MOVING' : '❌ STUCK'}`);
  });
  console.log(`   Result: ${allMoved ? '✅ PASS - all labels moving' : '❌ FAIL - some labels stuck'}\n`);
  
  console.log('=== VALIDATION COMPLETE ===');
  if (lockedIds.length === 7 && allLongEnough && allHaveSpeed && allMoved) {
    console.log('✅✅✅ ALL TESTS PASSED ✅✅✅');
  } else {
    console.log('❌ SOME TESTS FAILED - check details above');
  }
}, 5000);

// 5. Current status snapshot
console.log('5. Current positions:');
Object.entries(LOCKED_ROUTES).forEach(([id, route]) => {
  console.log(`   ${id}: s=${route.s.toFixed(1)}/${route.len.toFixed(1)}px, dir=${route.dir > 0 ? '→' : '←'}`);
});
console.log('');
