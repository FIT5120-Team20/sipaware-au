# Manual Testing Results

## US1.1 — Manually Record a Drink

Test Date: 27 Aug 2026

Result: PASS

All manual test cases TC-1.1-01 to TC-1.1-11 passed successfully.

Tested on the latest GitHub main branch.

## US1.2 — Quickly Record a Frequently Consumed Drink

Test Date: 28 Aug 2026

Result: PASS

All manual test cases TC-1.2-01 to TC-1.2-08 passed successfully.

Tested on the latest GitHub main branch.

## US1.3 — Manage Saved Drinks

Test Date: 28 Aug 2026

Result: PASS

All manual test cases TC-1.3-01 to TC-1.3-10 passed successfully.

Critical history-independence tests also passed.

Tested on the latest GitHub main branch.

## IndexedDB Persistence Verification Preparation

Use a fresh browser profile or clear disposable data from the undeployed
LocalStorage prototype, then verify:

1. Load the application and wait for browser data to finish loading.
2. Create a new Saved Drink and a new Drinking Record.
3. Open DevTools -> Application -> IndexedDB -> `alcohol_user_data`.
4. Confirm `saved_drinks` and `drinking_records` contain the new values.
5. Refresh the page (F5) and confirm both values remain available.
6. Edit and delete values from each collection and confirm the other collection
   remains independent.

For failure checking, block or simulate an IndexedDB write and confirm the UI
does not show success, does not clear entered values, and does not change the
visible persisted collection. The application must not use LocalStorage as a
fallback.
