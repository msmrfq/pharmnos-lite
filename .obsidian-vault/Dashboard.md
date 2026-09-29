# Project Dashboard

## Open Bugs
```dataview
TABLE status, file.mtime as "Last updated"
FROM "bugs"
WHERE status = "Open"
SORT file.mtime DESC
```

## Open Specs
```dataview
TABLE status
FROM "specs"
WHERE status != "Done"
```

## Recent Decisions
```dataview
TABLE file.mtime as "Date"
FROM "decisions"
SORT file.mtime DESC
LIMIT 5
```
