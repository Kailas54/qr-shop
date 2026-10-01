import { describe, expect, it } from 'vitest';
import {
  assertRoleCanTransition,
  assertValidTransition,
  listNextStatusesForRole,
} from './orderTransitions';

describe('orderTransitions', () => {
  it('allows the happy-path kitchen flow', () => {
    expect(() => assertValidTransition('placed', 'accepted')).not.toThrow();
    expect(() => assertRoleCanTransition('kitchen', 'placed', 'accepted')).not.toThrow();
    expect(() => assertRoleCanTransition('kitchen', 'accepted', 'preparing')).not.toThrow();
    expect(() => assertRoleCanTransition('kitchen', 'preparing', 'served')).not.toThrow();
  });

  it('blocks kitchen from cancelling or marking paid', () => {
    expect(() => assertRoleCanTransition('kitchen', 'placed', 'cancelled')).toThrow();
    expect(() => assertRoleCanTransition('kitchen', 'served', 'paid')).toThrow();
  });

  it('allows waiter to cancel but not mark paid', () => {
    expect(() => assertRoleCanTransition('waiter', 'placed', 'cancelled')).not.toThrow();
    expect(() => assertRoleCanTransition('waiter', 'served', 'paid')).toThrow();
  });

  it('allows owner to mark paid', () => {
    expect(() => assertRoleCanTransition('owner', 'served', 'paid')).not.toThrow();
  });

  it('lists next statuses for kitchen on placed', () => {
    expect(listNextStatusesForRole('kitchen', 'placed')).toEqual(['accepted']);
    expect(listNextStatusesForRole('waiter', 'served')).toEqual(['cancelled']);
    expect(listNextStatusesForRole('owner', 'served')).toEqual(['paid', 'cancelled']);
  });
});
