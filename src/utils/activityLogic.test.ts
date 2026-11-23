import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SIX_WEEK_ACTIVITIES,
  computeActivityProgress,
  validatePhotoUpload,
  validateWeeklyActivityUpdate,
} from './activityLogic';

test('DEFAULT_SIX_WEEK_ACTIVITIES contains 6 honest uncompleted weeks with zero fake photos', () => {
  assert.equal(DEFAULT_SIX_WEEK_ACTIVITIES.length, 6);
  for (let i = 0; i < 6; i += 1) {
    const week = DEFAULT_SIX_WEEK_ACTIVITIES[i];
    assert.equal(week.weekNumber, i + 1);
    assert.equal(week.status, 'Not Started');
    assert.equal(week.photos.length, 0);
    assert.equal(week.startDate, '');
    assert.equal(week.endDate, '');
    assert.ok(week.activities.length >= 4);
  }
});

test('computeActivityProgress summarizes Not Started, In Progress, and Completed weeks', () => {
  const initial = computeActivityProgress(DEFAULT_SIX_WEEK_ACTIVITIES);
  assert.equal(initial.completedCount, 0);
  assert.equal(initial.notStartedCount, 6);
  assert.equal(initial.percentComplete, 0);
  assert.equal(initial.overallLabel, 'Not Started');

  const mixed = DEFAULT_SIX_WEEK_ACTIVITIES.map((w) =>
    w.weekNumber <= 3
      ? { ...w, status: 'Completed' as const }
      : w.weekNumber === 4
      ? { ...w, status: 'In Progress' as const }
      : w
  );
  const progress = computeActivityProgress(mixed);
  assert.equal(progress.completedCount, 3);
  assert.equal(progress.inProgressCount, 1);
  assert.equal(progress.notStartedCount, 2);
  assert.equal(progress.percentComplete, 50);
  assert.equal(progress.overallLabel, 'In Progress');

  const allDone = DEFAULT_SIX_WEEK_ACTIVITIES.map((w) => ({
    ...w,
    status: 'Completed' as const,
  }));
  const finished = computeActivityProgress(allDone);
  assert.equal(finished.percentComplete, 100);
  assert.equal(finished.overallLabel, 'Completed');
});

test('validateWeeklyActivityUpdate rejects inverted dates and invalid statuses', () => {
  const badDate = validateWeeklyActivityUpdate({
    title: 'Topic Selection',
    description: 'Testing',
    activities: ['Step 1'],
    startDate: '2026-11-20',
    endDate: '2026-11-10',
    status: 'In Progress',
    reflection: '',
  });
  assert.equal(badDate.valid, false);

  const badStatus = validateWeeklyActivityUpdate({
    title: 'Topic Selection',
    description: 'Testing',
    activities: ['Step 1'],
    startDate: '2026-11-01',
    endDate: '2026-11-07',
    status: 'InvalidStatus',
    reflection: '',
  });
  assert.equal(badStatus.valid, false);

  const ok = validateWeeklyActivityUpdate({
    title: 'Topic Selection and Planning',
    description: 'Selected Android smartphone study scope.',
    activities: ['Selection of project topic', 'Preparation of project plan'],
    startDate: '2026-10-01',
    endDate: '2026-10-07',
    status: 'Completed',
    reflection: 'Learned how to classify 6 user professions.',
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.sanitized?.activities.length, 2);
});

test('validatePhotoUpload enforces valid image data URLs and blocks non-image payloads', () => {
  const invalid = validatePhotoUpload({
    fileName: 'evil.html',
    dataUrl: 'data:text/html;base64,PHNjcmlwdD4=',
  });
  assert.equal(invalid.valid, false);

  const valid = validatePhotoUpload({
    fileName: 'field-visit.png',
    caption: 'Survey session with college students',
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.sanitized?.caption, 'Survey session with college students');
});
