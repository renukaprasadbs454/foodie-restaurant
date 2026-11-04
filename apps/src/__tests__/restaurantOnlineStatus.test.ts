import {
  ACTIVE_ACCEPTED_ORDER_STATUSES,
  isActiveAcceptedOrderStatus,
  hasActiveAcceptedOrders,
  OFFLINE_BLOCKED_WARNING_MESSAGE,
} from '../features/orders/types';

describe('Restaurant online status & active order restrictions', () => {
  it('identifies accepted and preparing orders waiting for handover as active', () => {
    const activeStatuses = [
      'ACCEPTED',
      'PREPARING',
      'WAITING_FOR_DELIVERY_PARTNER',
      'READY_FOR_PICKUP',
      'ASSIGNED',
      'REACHED_RESTAURANT',
    ];

    activeStatuses.forEach((status) => {
      expect(isActiveAcceptedOrderStatus(status)).toBe(true);
      expect(ACTIVE_ACCEPTED_ORDER_STATUSES.has(status)).toBe(true);
    });
  });

  it('identifies handed-over, delivered, and terminal statuses as not blocking offline', () => {
    const nonActiveStatuses = [
      'PICKED_UP',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'COMPLETED',
      'CANCELLED',
      'REJECTED',
      'PENDING_PAYMENT',
      'PLACED',
      'CONFIRMED',
      '',
      undefined,
    ];

    nonActiveStatuses.forEach((status) => {
      expect(isActiveAcceptedOrderStatus(status)).toBe(false);
    });
  });

  it('returns true for hasActiveAcceptedOrders when at least one accepted active order exists', () => {
    const orders = [
      { status: 'DELIVERED' },
      { status: 'CANCELLED' },
      { status: 'PREPARING' },
    ];
    expect(hasActiveAcceptedOrders(orders)).toBe(true);
  });

  it('returns false for hasActiveAcceptedOrders after order is handed over (PICKED_UP)', () => {
    const orders = [
      { status: 'PICKED_UP' },
      { status: 'OUT_FOR_DELIVERY' },
      { status: 'DELIVERED' },
    ];
    expect(hasActiveAcceptedOrders(orders)).toBe(false);
  });

  it('returns false for hasActiveAcceptedOrders when all orders are completed or cancelled', () => {
    const orders = [
      { status: 'DELIVERED' },
      { status: 'COMPLETED' },
      { status: 'CANCELLED' },
      { status: 'REJECTED' },
    ];
    expect(hasActiveAcceptedOrders(orders)).toBe(false);
  });

  it('returns false for hasActiveAcceptedOrders when order list is empty or null', () => {
    expect(hasActiveAcceptedOrders([])).toBe(false);
    expect(hasActiveAcceptedOrders(null)).toBe(false);
    expect(hasActiveAcceptedOrders(undefined)).toBe(false);
  });

  it('has exact warning message as required', () => {
    expect(OFFLINE_BLOCKED_WARNING_MESSAGE).toBe(
      'You have an active order. Please complete and hand over your order before going offline.'
    );
  });
});

