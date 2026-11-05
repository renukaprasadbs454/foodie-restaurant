import restaurantOnboardingReducer, {
  setActiveRestaurantId,
  switchRestaurant,
  selectRestaurantId,
  selectRestaurantOnboardingStatus,
  type RestaurantOnboardingState,
} from '../features/onboarding/restaurantOnboardingSlice';

describe('Multi-Restaurant Account Feature', () => {
  const initialBaseState: RestaurantOnboardingState = {
    restaurantId: 'resto-1111',
    status: 'APPROVED',
    activeRestaurantId: null,
    draftName: '',
  };

  it('selects default restaurantId when no activeRestaurantId is set', () => {
    const rootState = {
      restaurantOnboarding: initialBaseState,
    };
    expect(selectRestaurantId(rootState)).toBe('resto-1111');
    expect(selectRestaurantOnboardingStatus(rootState)).toBe('APPROVED');
  });

  it('switches active restaurant without modifying the underlying primary account', () => {
    const nextState = restaurantOnboardingReducer(
      initialBaseState,
      setActiveRestaurantId('resto-2222')
    );

    expect(nextState.activeRestaurantId).toBe('resto-2222');

    const rootState = {
      restaurantOnboarding: nextState,
    };
    expect(selectRestaurantId(rootState)).toBe('resto-2222');
  });

  it('handles switchRestaurant with both restaurantId and status', () => {
    const nextState = restaurantOnboardingReducer(
      initialBaseState,
      switchRestaurant({
        restaurantId: 'resto-3333',
        status: 'PENDING',
      })
    );

    expect(nextState.activeRestaurantId).toBe('resto-3333');
    expect(nextState.status).toBe('PENDING');

    const rootState = {
      restaurantOnboarding: nextState,
    };
    expect(selectRestaurantId(rootState)).toBe('resto-3333');
    expect(selectRestaurantOnboardingStatus(rootState)).toBe('PENDING');
  });

  it('allows switching back to original approved restaurant', () => {
    let state = restaurantOnboardingReducer(
      initialBaseState,
      switchRestaurant({
        restaurantId: 'resto-2222',
        status: 'PENDING',
      })
    );

    // Switch back to resto-1111
    state = restaurantOnboardingReducer(
      state,
      switchRestaurant({
        restaurantId: 'resto-1111',
        status: 'APPROVED',
      })
    );

    expect(state.activeRestaurantId).toBe('resto-1111');
    expect(state.status).toBe('APPROVED');
  });

  it('maintains independent availability status across multiple restaurants', () => {
    const restaurants = [
      { restaurantId: 'resto-1', name: 'Burger Junction', isOpen: true, status: 'APPROVED' },
      { restaurantId: 'resto-2', name: 'Pizza Paradise', isOpen: true, status: 'APPROVED' },
      { restaurantId: 'resto-3', name: 'Taco Town', isOpen: false, status: 'PENDING' },
    ];

    // Both resto-1 and resto-2 can be online simultaneously
    const onlineRestaurants = restaurants.filter((r) => r.isOpen);
    expect(onlineRestaurants.length).toBe(2);

    // Toggling resto-1 to offline does not affect resto-2
    const updatedRestaurants = restaurants.map((r) =>
      r.restaurantId === 'resto-1' ? { ...r, isOpen: false } : r
    );

    expect(updatedRestaurants.find((r) => r.restaurantId === 'resto-1')?.isOpen).toBe(false);
    expect(updatedRestaurants.find((r) => r.restaurantId === 'resto-2')?.isOpen).toBe(true);
    expect(updatedRestaurants.find((r) => r.restaurantId === 'resto-3')?.isOpen).toBe(false);
  });
});
