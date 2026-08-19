import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePriority, recalculateAllPriorities, sortByPriority } from '../priority-engine.js';

test('Priority engine: AI confidence scoring', async (t) => {
  await t.test('Low confidence (<0.5) returns a score strictly below high-confidence equivalent', () => {
    const lowComplaint = {
      id: 'cmp-1',
      category: 'Pavement Distress',
      aiConfidence: 0.3,
      createdAt: '2026-08-09T08:40:00.000Z',
      lat: 13.1,
      lng: 77.8,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const highComplaint = {
      id: 'cmp-2',
      category: 'Pavement Distress',
      aiConfidence: 0.9,
      createdAt: '2026-08-09T08:40:00.000Z',
      lat: 13.1,
      lng: 77.8,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const low = calculatePriority(lowComplaint, []);
    const high = calculatePriority(highComplaint, []);
    assert.ok(low.score < high.score, `Low-conf score ${low.score} should be below high-conf score ${high.score}`);
  });

  await t.test('High confidence (>0.85) returns higher score', () => {
    const complaint = {
      id: 'cmp-1',
      category: 'Pothole',
      aiConfidence: 0.9,
      createdAt: '2026-08-09T08:40:00.000Z',
      lat: 12.9716,
      lng: 77.5946,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const result = calculatePriority(complaint, []);
    assert.ok(result.score >= 25, `Score ${result.score} should be >= 25 for high confidence`);
  });
});

test('Priority engine: Damage category scoring', async (t) => {
  await t.test('Pothole gets higher weight than Longitudinal Crack', () => {
    const potholeComplaint = {
      id: 'cmp-1',
      category: 'Pothole',
      aiConfidence: 0.8,
      createdAt: '2026-08-09T08:40:00.000Z',
      lat: 12.9716,
      lng: 77.5946,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const crackComplaint = {
      id: 'cmp-2',
      category: 'Longitudinal Crack',
      aiConfidence: 0.8,
      createdAt: '2026-08-09T08:40:00.000Z',
      lat: 12.9716,
      lng: 77.5946,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const potholeResult = calculatePriority(potholeComplaint, []);
    const crackResult = calculatePriority(crackComplaint, []);
    assert.ok(potholeResult.score > crackResult.score, 'Pothole should have higher priority than Longitudinal Crack');
  });
});

test('Priority engine: Complaint age scoring', async (t) => {
  await t.test('Older complaint gets higher priority', () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
    const recentDate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago

    const oldComplaint = {
      id: 'cmp-1',
      category: 'Pothole',
      aiConfidence: 0.8,
      createdAt: oldDate.toISOString(),
      lat: 12.9716,
      lng: 77.5946,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const recentComplaint = {
      id: 'cmp-2',
      category: 'Pothole',
      aiConfidence: 0.8,
      createdAt: recentDate.toISOString(),
      lat: 12.9716,
      lng: 77.5946,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };

    const oldResult = calculatePriority(oldComplaint, []);
    const recentResult = calculatePriority(recentComplaint, []);
    assert.ok(oldResult.score >= recentResult.score, 'Older complaint should have equal or higher priority');
  });
});

test('Priority engine: Location proximity scoring', async (t) => {
  await t.test('Complaint near hospital gets higher score', () => {
    // Hospital location: 12.9637, 77.5961
    const nearHospital = {
      id: 'cmp-1',
      category: 'Pothole',
      aiConfidence: 0.7,
      createdAt: '2026-08-09T08:40:00.000Z',
      lat: 12.9637,
      lng: 77.5961,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const farFromAny = {
      id: 'cmp-2',
      category: 'Pothole',
      aiConfidence: 0.7,
      createdAt: '2026-08-09T08:40:00.000Z',
      lat: 13.1,
      lng: 77.8,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };

    const nearResult = calculatePriority(nearHospital, []);
    const farResult = calculatePriority(farFromAny, []);
    assert.ok(nearResult.score > farResult.score, 'Complaint near hospital should have higher priority');
  });
});

test('Priority engine: Duplicate count scoring', async (t) => {
  await t.test('Complaint with duplicates nearby gets higher score', () => {
    const mainComplaint = {
      id: 'cmp-1',
      category: 'Pothole',
      aiConfidence: 0.8,
      createdAt: '2026-08-09T08:40:00.000Z',
      lat: 12.9716,
      lng: 77.5946,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const duplicateNearby1 = {
      id: 'cmp-2',
      category: 'Pothole',
      aiConfidence: 0.75,
      createdAt: '2026-08-09T08:45:00.000Z',
      lat: 12.9719,
      lng: 77.5949,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const duplicateNearby2 = {
      id: 'cmp-3',
      category: 'Pothole',
      aiConfidence: 0.72,
      createdAt: '2026-08-09T08:50:00.000Z',
      lat: 12.9714,
      lng: 77.5944,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const complaintFar = {
      id: 'cmp-4',
      category: 'Pothole',
      aiConfidence: 0.8,
      createdAt: '2026-08-09T08:40:00.000Z',
      lat: 12.9716,
      lng: 77.5946,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };

    const withDuplicates = calculatePriority(mainComplaint, [mainComplaint, duplicateNearby1, duplicateNearby2]);
    const withoutDuplicates = calculatePriority(complaintFar, [complaintFar]);

    assert.ok(withDuplicates.score > withoutDuplicates.score, 'Complaint with duplicates should have higher priority');
    const mentionsDuplicate = withDuplicates.reasons.some(r =>
      /duplicate complaint|similar complaint/i.test(r)
    );
    assert.ok(mentionsDuplicate, `Should mention duplicates/similar complaints in reasons. Got: ${JSON.stringify(withDuplicates.reasons)}`);
  });
});

test('Priority engine: Priority levels', async (t) => {
  await t.test('Score 0-24 maps to LOW', () => {
    const complaint = {
      id: 'cmp-1',
      category: 'Pavement Distress',
      aiConfidence: 0.2,
      createdAt: new Date(Date.now() - 1000).toISOString(),
      lat: 13.1,
      lng: 77.8,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const result = calculatePriority(complaint, []);
    assert.equal(result.level, 'LOW', `Expected LOW but got ${result.level} with score ${result.score}`);
    assert.ok(result.score >= 0 && result.score < 25, `Score ${result.score} should be 0-24`);
  });

  await t.test('Score 25-49 maps to MEDIUM', () => {
    const complaint = {
      id: 'cmp-1',
      category: 'Alligator Cracking',
      aiConfidence: 0.65,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lat: 13.0,
      lng: 77.7,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const result = calculatePriority(complaint, []);
    assert.equal(result.level, 'MEDIUM', `Expected MEDIUM but got ${result.level} with score ${result.score}`);
    assert.ok(result.score >= 25 && result.score < 50, `Score ${result.score} should be 25-49`);
  });

  await t.test('Score 50-74 maps to HIGH', () => {
    // Pothole + decent confidence + medium age + single duplicate = HIGH (but not CRITICAL)
    const factory = (i) => ({
      id: `cmp-near-${i}`,
      category: 'Pothole',
      aiConfidence: 0.7,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lat: 13.01 + i * 0.0005,
      lng: 77.65 + i * 0.0005,
      status: 'SUBMITTED',
      department: { name: 'Public Works' },
    });
    const complaint = {
      id: 'cmp-1',
      category: 'Pothole',
      aiConfidence: 0.72,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lat: 13.01,
      lng: 77.65,
      status: 'SUBMITTED',
      department: { name: 'Public Works' },
    };
    const all = [complaint, factory(1)];
    const result = calculatePriority(complaint, all);
    assert.ok(result.score >= 50 && result.score < 75, `Score ${result.score} should be 50..74 for HIGH level`);
    assert.equal(result.level, 'HIGH', `Expected HIGH but got ${result.level} with score ${result.score}`);
  });

  await t.test('Score 75-100 maps to CRITICAL', () => {
    const complaint = {
      id: 'cmp-1',
      category: 'Pothole',
      aiConfidence: 0.95,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      lat: 12.9637,
      lng: 77.5961,
      status: 'SUBMITTED',
      department: { name: 'Traffic Control' },
    };
    const result = calculatePriority(complaint, []);
    assert.equal(result.level, 'CRITICAL', `Expected CRITICAL but got ${result.level} with score ${result.score}`);
    assert.ok(result.score >= 75 && result.score <= 100, `Score ${result.score} should be 75-100`);
  });
});

test('Priority engine: Closed/Rejected status', async (t) => {
  await t.test('Closed complaints get LOW priority', () => {
    const complaint = {
      id: 'cmp-1',
      category: 'Pothole',
      aiConfidence: 0.9,
      createdAt: '2026-08-09T08:40:00.000Z',
      lat: 12.9637,
      lng: 77.5961,
      status: 'CLOSED',
      department: { name: 'Road Maintenance' },
    };
    const result = calculatePriority(complaint, []);
    assert.equal(result.level, 'LOW');
    assert.equal(result.score, 0);
  });

  await t.test('Rejected complaints get LOW priority', () => {
    const complaint = {
      id: 'cmp-1',
      category: 'Pothole',
      aiConfidence: 0.9,
      createdAt: '2026-08-09T08:40:00.000Z',
      lat: 12.9637,
      lng: 77.5961,
      status: 'REJECTED',
      department: { name: 'Road Maintenance' },
    };
    const result = calculatePriority(complaint, []);
    assert.equal(result.level, 'LOW');
    assert.equal(result.score, 0);
  });
});

test('Priority engine: Reason generation', async (t) => {
  await t.test('Reasons are meaningful and non-empty', () => {
    const complaint = {
      id: 'cmp-1',
      category: 'Pothole',
      aiConfidence: 0.9,
      createdAt: '2026-08-09T08:40:00.000Z',
      lat: 12.9716,
      lng: 77.5946,
      status: 'SUBMITTED',
      department: { name: 'Road Maintenance' },
    };
    const result = calculatePriority(complaint, []);
    assert.ok(Array.isArray(result.reasons));
    assert.ok(result.reasons.length > 0, 'Should have at least one reason');
    result.reasons.forEach(reason => {
      assert.ok(typeof reason === 'string' && reason.length > 0, 'Reason should be non-empty string');
    });
  });
});

test('Priority engine: Sorting complaints by priority', async (t) => {
  await t.test('sortByPriority sorts by level first, then score', () => {
    const complaints = [
      {
        id: 'cmp-1',
        priorityLevel: 'LOW',
        priorityScore: 20,
        category: 'Pothole',
        status: 'SUBMITTED',
      },
      {
        id: 'cmp-2',
        priorityLevel: 'CRITICAL',
        priorityScore: 80,
        category: 'Pothole',
        status: 'SUBMITTED',
      },
      {
        id: 'cmp-3',
        priorityLevel: 'HIGH',
        priorityScore: 60,
        category: 'Pothole',
        status: 'SUBMITTED',
      },
      {
        id: 'cmp-4',
        priorityLevel: 'HIGH',
        priorityScore: 70,
        category: 'Pothole',
        status: 'SUBMITTED',
      },
    ];

    const sorted = sortByPriority(complaints);
    assert.equal(sorted[0].id, 'cmp-2', 'CRITICAL should be first');
    assert.equal(sorted[1].id, 'cmp-4', 'HIGH with score 70 should be second');
    assert.equal(sorted[2].id, 'cmp-3', 'HIGH with score 60 should be third');
    assert.equal(sorted[3].id, 'cmp-1', 'LOW should be last');
  });
});

test('Priority engine: Recalculating all priorities', async (t) => {
  await t.test('recalculateAllPriorities updates all complaints', () => {
    const complaints = [
      {
        id: 'cmp-1',
        category: 'Pothole',
        aiConfidence: 0.9,
        createdAt: '2026-08-09T08:40:00.000Z',
        lat: 12.9716,
        lng: 77.5946,
        status: 'SUBMITTED',
        department: { name: 'Road Maintenance' },
      },
      {
        id: 'cmp-2',
        category: 'Crack',
        aiConfidence: 0.6,
        createdAt: '2026-08-09T08:40:00.000Z',
        lat: 12.9716,
        lng: 77.5946,
        status: 'SUBMITTED',
        department: { name: 'Road Maintenance' },
      },
    ];

    const result = recalculateAllPriorities(complaints);
    assert.equal(result.length, 2);
    result.forEach(c => {
      assert.ok(c.priorityScore !== undefined);
      assert.ok(c.priorityLevel !== undefined);
      assert.ok(Array.isArray(c.priorityReasons));
    });
    assert.ok(result[0].priorityScore > result[1].priorityScore, 'First complaint should have higher priority');
  });
});
