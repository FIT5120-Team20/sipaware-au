# Data Boundary

This directory is reserved for future approved project-managed reference or
content data. Do not add invented production datasets, placeholder CSV/JSON/SQL
files, or personal drinking data.

Personal Saved Drinks and Drinking Records remain on the user's device in the
browser-native IndexedDB database `alcohol_user_data`, in the `saved_drinks` and
`drinking_records` object stores. They must not be placed in this directory,
sent to FastAPI, or stored in AWS RDS.

Future RDS schemas, ingestion logic, and reference-data mappings will be added
only after the team supplies approved real reference IDs and contracts. Fields
such as category, variant, and ABV reference IDs are deliberately not guessed
in the current IndexedDB persistence phase.
