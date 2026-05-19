# Drill 8 — Python: Log and File Parsing

## What this drill covers

Reading structured or semi-structured text (logs, CSVs, JSONLines, fixed-width), extracting fields, and producing a clean output — without loading the entire file into memory.

## Core concepts

- Line-by-line iteration with a generator: `for line in file` — never `file.readlines()` for large files
- Regex extraction: `re.compile` the pattern once outside the loop, then `pattern.match(line)` per line
- Parsing common formats: JSON per line (`json.loads`), CSV (`csv.DictReader`), key=value pairs
- Handling malformed lines: skip, log, or count — decide and be consistent
- Output to a dict or dataclass, not to free-form strings

## Problem shapes to expect

- "Parse this Apache access log and return a dict of `{ip: request_count}`."
- "Given a JSONLines file of events, extract all events where `status == 'error'` and return the unique `user_id`s."
- "Read a CSV, compute the mean of column X, handle missing values."

## What interviewers probe

- Do you read the whole file into memory, or iterate line by line?
- Do you compile the regex outside the loop?
- Do you handle the malformed-line case, or assume clean data?
- Is your code O(n) in the number of lines?

## Interview context

Python round, medium. The signal is clean, idiomatic Python — correct dict/list/set use, no unnecessary list construction when a generator or set is better.

## How to use SDLC_VALIDATION.md

Write your solution in `solution.py`. Include a `sample.log` or `sample.jsonl` test file. Run it and confirm output. Log any parsing decision (how malformed lines are handled) in Section 15 of `SDLC_VALIDATION.md`.
