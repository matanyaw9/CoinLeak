-- Base tables owned by the skeleton. Domain tables arrive in 0002 (ledger spec).

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
