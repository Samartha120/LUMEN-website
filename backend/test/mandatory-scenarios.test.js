import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePriority,
  scoreDamageCategory,
  scoreAiConfidence,
  scoreDuplicateCount,
  scoreLocationProximity,
  scoreComplaintAge,
  scoreDepartmentRules,
} from '../priority-engine.js';

/**
 * IMPROVEMENT 13 — Mandatory test scenarios for Feature 3:
 *  1. Low damage complaint                → LOW
 *  2. Medium damage complaint             → MEDIUM
 *  3. Severe pothole                      → HIGH
 *  4. Severe near hospital + duplicates   → CRITICAL
 *  5. High AI confidence alone            → MUST NOT be CRITICAL
 *  6. Missing GPS                         → still calculates priority (no throw)
 *  7. Missing duplicate count             → still calculates priority (no throw)
 *  8. Old unresolved complaint            → priority increases with age
 */

const HOSPITAL_LAT = 12.9637;
const HOSPITAL_LNG = 77.5961;
const FAR_LAT = 13.3;
const FAR_LNG = 78.0;

function daysAgoISO(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

// ----- Scenario 1 -----
test('Scenario 1 — Low damage complaint → LOW', () => {
  const complaint = {
    id: 's1-low',
    category: 'Pavement Distress',
    aiConfidence: 0.35,
    createdAt: daysAgoISO(0),
    lat: FAR_LAT,
    lng: FAR_LNG,
    status: 'SUBMITTED',
    department: { name: 'Public Works' },
  };
  const result = calculatePriority(complaint, []);
  assert.equal(result.level, 'LOW', `Expected LOW, got ${result.level} (score ${result.score})`);
  assert.ok(result.score >= 0 && result.score < 25, `Score ${result.score} must be 0..24 for LOW`);
  assert.ok(Array.isArray(result.reasons) && result.reasons.length > 0, 'Reasons must be generated');
  assert.ok(result.factors.categoryScore <= 15, 'Low damage cap on category');
});

// ----- Scenario 2 -----
test('Scenario 2 — Medium damage complaint → MEDIUM', () => {
  const complaint = {
    id: 's2-medium',
    category: 'Longitudinal Crack',
    aiConfidence: 0.65,
    createdAt: daysAgoISO(2),
    lat: 13.02,
    lng: 77.72,
    status: 'SUBMITTED',
    department: { name: 'Road Maintenance' },
  };
  const result = calculatePriority(complaint, []);
  assert.equal(result.level, 'MEDIUM', `Expected MEDIUM, got ${result.level} (score ${result.score})`);
  assert.ok(result.score >= 25 && result.score < 50, `Score ${result.score} must be 25..49 for MEDIUM`);
});

// ----- Scenario 3 -----
test('Scenario 3 — Severe pothole → HIGH', () => {
  const complaint = {
    id: 's3-high',
    category: 'Pothole',
    aiConfidence: 0.82,
    createdAt: daysAgoISO(3),
    lat: 12.99,
    lng: 77.65,
    status: 'SUBMITTED',
    department: { name: 'Road Maintenance' },
  };
  const result = calculatePriority(complaint, []);
  assert.equal(result.level, 'HIGH', `Expected HIGH, got ${result.level} (score ${result.score})`);
  assert.ok(result.score >= 50 && result.score < 75, `Score ${result.score} must be 50..74 for HIGH`);
  assert.ok(result.reasons.some(r => /pothole/i.test(r)), 'Reasons should mention severe pothole');
});

// ----- Scenario 4 -----
test('Scenario 4 — Severe damage near hospital + duplicates → CRITICAL', () => {
  const main = {
    id: 's4-crit-main',
    category: 'Pothole',
    aiConfidence: 0.92,
    createdAt: daysAgoISO(6),
    lat: HOSPITAL_LAT,
    lng: HOSPITAL_LNG,
    status: 'SUBMITTED',
    department: { name: 'Traffic Control' },
  };
  const dupFactory = (i) => ({
    id: `s4-dup-${i}`,
    category: 'Pothole',
    aiConfidence: 0.8,
    createdAt: daysAgoISO(5),
    lat: HOSPITAL_LAT + 0.0005 * i,
    lng: HOSPITAL_LNG + 0.0005 * i,
    status: 'SUBMITTED',
    department: { name: 'Traffic Control' },
  });
  const dup1 = dupFactory(1);
  const dup2 = dupFactory(2);
  const dup3 = dupFactory(3);
  const dup4 = dupFactory(4);
  const dup5 = dupFactory(5);

  const all = [main, dup1, dup2, dup3, dup4, dup5];
  const result = calculatePriority(main, all);

  assert.equal(result.level, 'CRITICAL', `Expected CRITICAL, got ${result.level} (score ${result.score})`);
  assert.ok(result.score >= 75 && result.score <= 100, `Score ${result.score} must be 75..100 for CRITICAL`);
  assert.ok(result.duplicateCount >= 5, `Expected 5+ duplicates, got ${result.duplicateCount}`);
  assert.ok(result.nearbyLocations.some(n => /Hospital/i.test(n)), 'Must detect near hospital');
  assert.ok(result.reasons.some(r => /duplicate/i.test(r)), 'Reasons must mention duplicates');
  assert.ok(result.reasons.some(r => /[Hh]ospital/.test(r)), 'Reasons must mention hospital proximity');
});

// ----- Scenario 5 -----
test('Scenario 5 — High YOLO confidence alone MUST NOT be CRITICAL', () => {
  // Only high confidence. Category weak, 0 duplicates, far location, brand new, mild dept.
  const complaint = {
    id: 's5-notcrit',
    category: 'Pavement Distress',
    aiConfidence: 0.99,
    createdAt: daysAgoISO(0),
    lat: FAR_LAT,
    lng: FAR_LNG,
    status: 'SUBMITTED',
    department: { name: 'Public Works' },
  };
  const result = calculatePriority(complaint, []);
  assert.notEqual(result.level, 'CRITICAL', `High confidence alone must NOT be CRITICAL (was ${result.level}, score ${result.score})`);

  // Direct component tests confirm: confidence alone caps at 15 (below 75 needed for CRITICAL)
  const confidenceComponent = scoreAiConfidence(0.99);
  assert.ok(confidenceComponent <= 15, `Confidence alone capped at 15, got ${confidenceComponent}`);

  const lowBaselineButHighConf = scoreDamageCategory('Unknown') + scoreAiConfidence(1.0) +
    scoreDuplicateCount(0) + scoreLocationProximity(FAR_LAT, FAR_LNG).score +
    scoreComplaintAge(daysAgoISO(0)) + scoreDepartmentRules('Public Works', Date.now());
  assert.ok(lowBaselineButHighConf < 75, `Baseline with max confidence should be <75, got ${lowBaselineButHighConf}`);
});

// ----- Scenario 6 -----
test('Scenario 6 — Missing GPS should still calculate priority (no failure)', () => {
  const complaintNoLat = {
    id: 's6-nogps',
    category: 'Pothole',
    aiConfidence: 0.75,
    createdAt: daysAgoISO(1),
    status: 'SUBMITTED',
    department: { name: 'Road Maintenance' },
  };
  let result;
  assert.doesNotThrow(() => { result = calculatePriority(complaintNoLat, []); },
    'calculatePriority must not throw when lat/lng missing');
  assert.ok(typeof result.score === 'number', 'Score must be a number');
  assert.ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(result.level), 'Level must be valid');
  assert.equal(result.factors.locationScore, 0, 'Location score must be 0 when GPS missing');
  assert.deepEqual(result.nearbyLocations, [], 'Nearby list must be empty without GPS');
});

// ----- Scenario 7 -----
test('Scenario 7 — Missing duplicate count should still calculate priority', () => {
  // No `allComplaints` provided at all → engine should treat dup count as 0.
  const complaint = {
    id: 's7-nodup',
    category: 'Road Crack',
    aiConfidence: 0.7,
    createdAt: daysAgoISO(2),
    lat: 12.97,
    lng: 77.59,
    status: 'SUBMITTED',
    department: { name: 'Road Maintenance' },
  };
  let result;
  assert.doesNotThrow(() => { result = calculatePriority(complaint); },
    'calculatePriority must not throw when no allComplaints');
  assert.ok(typeof result.score === 'number');
  assert.equal(result.duplicateCount, 0, 'Duplicate count should be 0 when empty context');
  assert.equal(result.factors.duplicateScore, 0, 'Duplicate factor should be 0 when empty context');

  // Same complaint alone in the array → no other identical neighbours.
  const result2 = calculatePriority(complaint, [complaint]);
  assert.equal(result2.duplicateCount, 0);
});

// ----- Scenario 8 -----
test('Scenario 8 — Old unresolved complaint priority increases with age', () => {
  const base = (ageDays) => ({
    id: `s8-age-${ageDays}d`,
    category: 'Pothole',
    aiConfidence: 0.7,
    createdAt: daysAgoISO(ageDays),
    lat: 13.0,
    lng: 77.7,
    status: 'SUBMITTED',
    department: { name: 'Road Maintenance' },
  });

  const fresh = calculatePriority(base(0), []);
  const threeDays = calculatePriority(base(3), []);
  const sixDays = calculatePriority(base(6), []);
  const fourteenDays = calculatePriority(base(14), []);

  // Factor-level assertion: ageScore buckets should be strictly non-decreasing.
  assert.ok(fresh.factors.ageScore <= threeDays.factors.ageScore,
    `0d ageScore (${fresh.factors.ageScore}) ≤ 3d ageScore (${threeDays.factors.ageScore})`);
  assert.ok(threeDays.factors.ageScore <= sixDays.factors.ageScore,
    `3d ageScore (${threeDays.factors.ageScore}) ≤ 6d ageScore (${sixDays.factors.ageScore})`);
  assert.ok(sixDays.factors.ageScore <= fourteenDays.factors.ageScore,
    `6d ageScore (${sixDays.factors.ageScore}) ≤ 14d ageScore (${fourteenDays.factors.ageScore})`);

  // 7+ days should hit MAX age score (10).
  assert.equal(fourteenDays.factors.ageScore, 10, '14d → max ageScore of 10');

  // Overall priority should strictly rise.
  assert.ok(fresh.score <= threeDays.score,
    `0d score ${fresh.score} ≤ 3d score ${threeDays.score}`);
  assert.ok(sixDays.score < fourteenDays.score,
    `6d score ${sixDays.score} < 14d score ${fourteenDays.score} (old unresolved should rise)`);

  // Resolved (CLOSED) complaint does NOT receive age priority.
  const fourteenDaysClosed = calculatePriority({ ...base(14), status: 'CLOSED' }, []);
  assert.equal(fourteenDaysClosed.score, 0, 'Closed complaint should receive zero priority');
  assert.equal(fourteenDaysClosed.level, 'LOW');
});
