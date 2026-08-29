# Data Boundary

This directory is reserved for approved project-managed reference or content
artifacts. Do not add copied production datasets, placeholder CSV/JSON/SQL files,
credentials, or personal drinking data.

The live project-managed drink reference is stored in Neon PostgreSQL and read
through FastAPI's SELECT-only repository. Database schema management and
production reference contents remain outside this directory.

Personal SavedDrinks and DrinkingRecords remain on the user's device in the
browser-native IndexedDB database `alcohol_user_data`, in the `saved_drinks` and
`drinking_records` object stores. They must not be placed in this directory,
sent to FastAPI, or stored in Neon.
