import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPwaUpdateBlockReason,
  isProtectedWorkRoute,
  type PwaUpdateSafetyState
} from '../src/pwa/updatePolicy';

const safeState: PwaUpdateSafetyState = {
  pendingOperations: 0,
  isSyncing: false,
  isDocumentVisible: true,
  isProtectedRoute: false,
  hasOpenDialog: false,
  hasActiveFormControl: false
};

test('allows an automatic update on an idle safe screen', () => {
  assert.equal(getPwaUpdateBlockReason(safeState), null);
});

test('blocks updates while offline operations are pending', () => {
  assert.equal(
    getPwaUpdateBlockReason({ ...safeState, pendingOperations: 2 }),
    'pending-operations'
  );
});

test('blocks updates while editing orders and reports', () => {
  assert.equal(isProtectedWorkRoute('/ordenes-servicio/OS-123'), true);
  assert.equal(isProtectedWorkRoute('/ordenes-servicio/nuevo'), true);
  assert.equal(isProtectedWorkRoute('/informes/INF-123'), true);
  assert.equal(isProtectedWorkRoute('/dashboard'), false);
});

test('prioritizes preserving queued work over other blockers', () => {
  assert.equal(
    getPwaUpdateBlockReason({
      ...safeState,
      pendingOperations: 1,
      isProtectedRoute: true,
      hasOpenDialog: true
    }),
    'pending-operations'
  );
});
