import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { clearCredentials } from '../auth/authSlice';
import type { RestaurantStatus } from './types';

export const DEFAULT_DEV_RESTAURANT_ID = 'e125642d-a14a-4e80-8e51-c0534a58b35f';

/**
 * Onboarding session — UI-API restaurantOnboardingFormSlice.
 * Persist restaurantId (+ status) for cold-start Partial OK (GAP-API-03).
 */
export type RestaurantOnboardingState = {
  restaurantId: string | null;
  activeRestaurantId: string | null;
  status: RestaurantStatus | null;
  draftName: string;
};

const initialState: RestaurantOnboardingState = {
  restaurantId: null,
  activeRestaurantId: null,
  status: null,
  draftName: '',
};

const restaurantOnboardingSlice = createSlice({
  name: 'restaurantOnboarding',
  initialState,
  reducers: {
    setRestaurantCreated(
      state,
      action: PayloadAction<{ restaurantId: string; status?: RestaurantStatus }>,
    ) {
      state.restaurantId = action.payload.restaurantId;
      state.activeRestaurantId = action.payload.restaurantId;
      state.status = action.payload.status ?? 'PENDING';
    },
    setActiveRestaurantId(state, action: PayloadAction<string>) {
      state.restaurantId = action.payload;
      state.activeRestaurantId = action.payload;
    },
    switchRestaurant(
      state,
      action: PayloadAction<{ restaurantId: string; status?: RestaurantStatus }>,
    ) {
      state.restaurantId = action.payload.restaurantId;
      state.activeRestaurantId = action.payload.restaurantId;
      if (action.payload.status) {
        state.status = action.payload.status;
      }
    },
    setRestaurantStatus(state, action: PayloadAction<RestaurantStatus | null>) {
      state.status = action.payload;
    },
    setDraftName(state, action: PayloadAction<string>) {
      state.draftName = action.payload;
    },
    clearOnboarding(state) {
      state.restaurantId = null;
      state.activeRestaurantId = null;
      state.status = null;
      state.draftName = '';
    },
  },
  extraReducers: (builder) => {
    builder.addCase(clearCredentials, (state) => {
      state.restaurantId = null;
      state.activeRestaurantId = null;
      state.status = null;
      state.draftName = '';
    });
  },
});

export const {
  setRestaurantCreated,
  setActiveRestaurantId,
  switchRestaurant,
  setRestaurantStatus,
  setDraftName,
  clearOnboarding,
} = restaurantOnboardingSlice.actions;

export const selectRestaurantId = (state: {
  restaurantOnboarding: RestaurantOnboardingState;
}) => state.restaurantOnboarding.activeRestaurantId || state.restaurantOnboarding.restaurantId;

export const selectActiveRestaurantId = selectRestaurantId;

export const selectRestaurantOnboardingStatus = (state: {
  restaurantOnboarding: RestaurantOnboardingState;
}) => state.restaurantOnboarding.status;

export default restaurantOnboardingSlice.reducer;
