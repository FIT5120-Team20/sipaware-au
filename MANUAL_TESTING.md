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

## US1.4 — Correct a Drinking Record

Test Date: 18 Sep 2026

Result: PASS

All manual test cases for editing, deleting, and validating drinking record corrections passed successfully.

Existing drinking records could be edited and deleted correctly.
Invalid or incomplete corrections were prevented from being saved.

Tested on the latest GitHub main branch.

## US2.1 — Understand My Alcohol Consumption

Test Date: 18 Sep 2026

Result: PASS

All manual test cases for standard drink calculations and Australian guideline comparisons passed successfully.

Daily and weekly standard drink totals were calculated and displayed correctly.
Relevant guideline information and explanation links were displayed correctly.

Tested on the latest GitHub main branch.

## US2.2 — Receive Drinking and Driving Safety Guidance

Test Date: 18 Sep 2026

Result: PASS

All manual test cases for drinking and driving safety guidance passed successfully.

Driving-safety guidance was displayed after recording alcohol consumption.
No BAC prediction or personalised safe-to-drive prediction was provided.
Relevant further information could be accessed successfully.

Tested on the latest GitHub main branch.

## US2.3 — Explore Alcohol Guidelines and Age-Related Information

Test Date: 18 Sep 2026

Result: PASS

All manual test cases for alcohol guidelines and age-related information passed successfully.

Standard drinks, Australian alcohol guidelines, alcohol and ageing,
driving, medicines, and trusted source information were displayed correctly.

Relevant Learn More links opened the corresponding information sections.

Tested on the latest GitHub main branch.

## US3.1 — Find a Drink Using a Barcode

Test Date: 18 Sep 2026

Result: PASS

All manual test cases for barcode-assisted drink capture passed successfully.

The barcode scanner opened correctly and supported live camera scanning
and photo selection.

Matching drinks could be found and passed into the existing Record flow.
Scan Again, unreadable barcode, no matching drink, and manual-entry
fallback behaviours worked correctly.

Tested on the latest GitHub main branch.

## US3.2 — Capture Drink Details from a Label

Test Date: 18 Sep 2026

Result: PASS

All manual test cases for drink label recognition passed successfully.

Recognised drink information was added to the manual recording form
and remained editable before confirmation.

Partial recognition, unsuccessful recognition, and scanning another
label were handled correctly.

Tested on the latest GitHub main branch.

## US4.1 — View Drinking History

Test Date: 18 Sep 2026

Result: PASS

All manual test cases for viewing drinking history passed successfully.

Drinking records were grouped and displayed correctly by date.
Users could navigate between months and select a specific month and year.
The empty state was displayed correctly when no records were available.

Tested on the latest GitHub main branch.

## US4.2 — Correct Drinking Records

Test Date: 18 Sep 2026

Result: PASS

All manual test cases for correcting drinking records in History passed successfully.

Edit and Delete actions worked correctly.
Manual and database-based drinking records could be edited as required.
Deletion required confirmation, and cancelling an edit or deletion
left the original record unchanged.

History and related summaries updated correctly after changes.

Tested on the latest GitHub main branch.

## US4.3 — View Drinking Trends

Test Date: 18 Sep 2026

Result: PASS

All manual test cases for drinking trends passed successfully.

Past 7 days and Past 4 weeks views displayed the expected drinking data,
summaries, and guideline references.

Previous-period comparisons and recorded drinking patterns were displayed
correctly when sufficient data was available.

The empty state was displayed correctly when there was not enough recorded data.

Tested on the latest GitHub main branch.

## US4.4 — Export a Drinking Report

Test Date: 18 Sep 2026

Result: PASS

All manual test cases for drinking report generation and export passed successfully.

The four-week report displayed the reporting period, drinking summary,
guideline-related information, weekly trend, and recorded drinking history.

Insufficient-history handling worked correctly.
Available reports could be exported successfully as PDF.

Tested on the latest GitHub main branch.

## IndexedDB Persistence Verification

Result: PASS

IndexedDB persistence was verified successfully.

Saved Drinks and Drinking Records were stored in the expected IndexedDB
collections and remained available after refreshing the application.

Editing and deleting data in one collection did not incorrectly modify
the other collection.

No LocalStorage fallback was used for persisted drinking data.

Tested on the latest GitHub main branch.

## Overall Result

Result: PASS

All implemented User Stories from US1.1 to US4.4 were manually tested
and passed successfully.

No critical functional defects were identified during manual testing.