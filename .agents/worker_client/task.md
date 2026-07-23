# Task: Implement client.ts

## Objective
Write the complete implementation for `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/mobile/core_engine/src/network/client.ts`.

## Specifications
1. Import `axios` and `setupCache`, `buildStorage` from `axios-cache-interceptor`.
2. Import `AsyncStorage` from `@react-native-async-storage/async-storage`.
3. Import `getFallbackData` from `../../../constants/mockData` (ensure exact relative path import `from '../../../constants/mockData'`).
4. Implement the custom `offlineStorage` using `buildStorage` that wraps AsyncStorage for GET requests.
5. Create `client` by calling `setupCache` with `staleIfError: true` and cache methods restricted to `['get']`.
6. Inject a custom response interceptor on `client` to catch network connection errors (connection timeout, `ERR_NETWORK` code, or "Network Error" messages) and return mock data resolved via `getFallbackData(url)`.
7. The implementation must exactly match the design in `C:/Users/user/Desktop/school_contest/Anyway_the_Sea/.agents/orchestrator/handoff.md`.

## Constraints
1. **No Cheating**: All implementations must be genuine. Do not bypass or hardcode the offline adapter's storage behavior.
