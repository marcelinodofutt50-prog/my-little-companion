export function shouldShowNoRenewalOptions(state: {
  loggedIn: boolean | null;
  loading: boolean;
  error: string | null;
  optionCount: number;
}): boolean {
  return state.loggedIn === true && !state.loading && !state.error && state.optionCount === 0;
}
