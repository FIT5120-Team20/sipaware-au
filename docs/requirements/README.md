# Requirements Placeholder

This directory is reserved for requirements agreed by FIT5120 Team20 and project stakeholders.

The current implemented scope is limited to:

- a buildable React, TypeScript, and Vite frontend;
- a runnable FastAPI backend;
- a health endpoint and local connectivity indicator;
- Epic 1 US1.1 manual drink capture with device-local persistence;
- Epic 1 US1.2 explicit reusable drink saving and quick recording from My Drinks, also with device-local persistence;
- Epic 1 US1.3 viewing, editing and confirmed deletion of reusable My Drinks definitions without changing historical records;
- Epic 1 US1.4 validated correction and confirmed deletion of displayed recent DrinkingRecord snapshots without changing My Drinks;
- Epic 2 US2.1 locally derived standard-drink feedback against public DAILY and rolling-seven-local-calendar-day guideline thresholds;
- Epic 2 US2.2 general drinking-and-driving safety guidance triggered by an eligible device-local record for today;
- Epic 2 US2.3 API-driven alcohol guidelines, ageing, driving, medicines, and legal information with trusted Australian source links;
- lightweight architecture and project documentation.

Other unimplemented stories remain excluded. US2.2 provides no BAC estimate,
sober-time prediction, legal-limit result, or personalised driving clearance.
Being below an alcohol guideline does not mean it is safe to drive. US2.3 is
general educational information only: it provides no personalised medical or
legal advice, BAC estimate, safe-to-drive prediction, medicine checker, or
individual risk calculation. Its live ALCOHOL_AGEING wording remains subject to
the authorised data-owner update and final content acceptance. Authentication
is not currently in scope unless later requirements state otherwise. Future
requirements must be recorded here without inferring unapproved product or data
behaviour.
