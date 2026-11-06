import { normalizeProfileCard } from './domain.js';

export function setPreference(state, key, value) {
  return { ...state, preferences: { ...state.preferences, [key]: value, ...(key === 'weeklyGoal' ? { weeklyGoalSource: 'manual' } : {}) } };
}

export function setSharingPreference(state, key, value) {
  return { ...state, preferences: { ...state.preferences, sharing: { ...state.preferences.sharing, [key]: value } } };
}

export function setProjectSharing(state, id, shared) {
  return { ...state, courses: state.courses.map((course) => course.id === id ? { ...course, shared } : course) };
}

export function updateProfile(state, patch) {
  return { ...state, profile: normalizeProfileCard({ ...state.profile, ...patch }) };
}
