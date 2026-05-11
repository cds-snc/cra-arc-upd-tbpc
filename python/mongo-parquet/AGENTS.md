# Repository Guidelines

## Scope
- Treat `/workspaces/cra-arc-upd-tbpc/python/mongo-parquet` as the complete project root for this workspace.
- Ignore the surrounding monorepo unless the user explicitly asks to work outside this package.
- Prefer changes that are self-contained to this package and do not introduce dependencies on sibling apps or libraries.

## Project Structure
- Python package code lives in `src/mongo_parquet/`.
- Collection schema definitions live in `src/mongo_parquet/schemas/`.
- View calculation logic lives in `src/mongo_parquet/views/`.
- CLI entrypoint is `src/mongo_parquet/__main__.py`.
- Utility or one-off scripts live directly under `src/`, such as `src/migrate_parquet_schemas.py`.
- Local parquet data snapshots and backups live in `src/data/`, `src/data_backup/`, and `src/.sync_temp/`; treat them as fixtures/data, not source code.

## Environment And Tooling
- Python version is `3.12+` and dependencies are managed through `pyproject.toml` and `uv.lock`.
- Use `uv run ...` for local commands when possible so execution stays aligned with the locked environment.
- If a command must run through the virtualenv directly, prefer `.venv/bin/...`.

## Common Commands
- `uv run pytest` runs the test suite.
- `uv run pytest path/to/test_file.py -q` runs a focused test file.
- `uv run basedpyright` runs static type checking.
- `uv run python -m mongo_parquet --help` shows CLI options.
- `uv run python src/migrate_parquet_schemas.py` runs the schema migration utility if needed.

## Coding Style
- Follow existing Python style in the package: type hints where practical, small focused functions, and module-level docstrings where they already exist.
- Match the local naming patterns already in use. Do not rename files to force a different convention unless the user asks for that refactor.
- Keep imports explicit and local-package imports rooted at `mongo_parquet` where reasonable.
- Add brief comments only when the logic is not immediately obvious.

## Testing Guidelines
- Use `pytest`.
- Keep tests close to the code they cover. Existing tests include files named `*_test.py`; preserve the local convention unless there is a reason to align the suite differently.
- Prefer deterministic unit tests over tests that require live MongoDB or remote storage.
- For tests that read or write parquet files, use a dedicated test data directory rather than `src/data/`, `src/data_backup/`, or other working datasets.
- Generate parquet test fixtures during test setup and make the generated data conform to the current schema definitions so parquet reads, writes, and schema-sensitive logic are exercised against realistic inputs.
- When touching schema, sampling, storage, or date-range logic, add or update regression coverage.

## Data And Safety
- Be careful with commands that mutate `src/data/`, `src/data_backup/`, remote storage, or MongoDB targets.
- Do not run import/export or sync commands against live infrastructure unless the user explicitly asks.
- Prefer dry inspection of parquet files and schemas before any write operation.

## Planning
- For multi-step features or meaningful refactors, use an ExecPlan if the work is complex enough to benefit from one.
