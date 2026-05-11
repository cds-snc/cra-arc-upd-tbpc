from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path
from typing import Any

import polars as pl

from ... import MongoParquet
from ..aa_searchterms import AASearchTerms
from ..activity_map import ActivityMap
from ..calldrivers import Calldrivers
from ..feedback import Feedback
from ..gsc_searchterms import GSCSearchTerms
from ..lib import RefSyncContext
from ..page_metrics import PageMetrics
from ..pages import Pages
from ..readability import Readability
from ..tasks import Tasks

STRING_LIST = pl.List(pl.String())
GC_TASKS_LIST = pl.List(pl.Struct([pl.Field("title", pl.String())]))

PAGES_SCHEMA: dict[str, pl.DataType] = {
    "_id": pl.String(),
    "url": pl.String(),
    "tasks": STRING_LIST,
    "projects": STRING_LIST,
}

TASKS_SCHEMA: dict[str, pl.DataType] = {
    "_id": pl.String(),
    "tpc_ids": pl.List(pl.Int32()),
    "projects": STRING_LIST,
    "gc_tasks": GC_TASKS_LIST,
}

READABILITY_SCHEMA: dict[str, pl.DataType] = {
    "_id": pl.String(),
    "url": pl.String(),
    "page": pl.String(),
}

PAGE_REF_SCHEMA: dict[str, pl.DataType] = {
    "_id": pl.String(),
    "url": pl.String(),
    "page": pl.String(),
    "tasks": STRING_LIST,
    "projects": STRING_LIST,
}

PAGE_REF_WITH_UX_SCHEMA: dict[str, pl.DataType] = {
    **PAGE_REF_SCHEMA,
    "ux_tests": STRING_LIST,
}

CALLDRIVERS_SCHEMA: dict[str, pl.DataType] = {
    "_id": pl.String(),
    "tpc_id": pl.Int32(),
    "tasks": STRING_LIST,
    "projects": STRING_LIST,
}

def oid(value: int) -> str:
    return f"{value:024x}"

def example_url(slug: str) -> str:
    return f"https://example.test/{slug}"

def _frame_from_rows(
    rows: list[dict[str, Any]], schema: dict[str, pl.DataType]
) -> pl.DataFrame:
    return pl.DataFrame(
        {
            name: pl.Series(
                name,
                [row.get(name) for row in rows],
                dtype=dtype,
            )
            for name, dtype in schema.items()
        }
    )

def write_parquet(
    path: Path,
    rows: list[dict[str, Any]],
    schema: dict[str, pl.DataType],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    _frame_from_rows(rows, schema).write_parquet(path)

def write_partitioned_dataset(
    root: Path,
    rows: list[dict[str, Any]],
    schema: dict[str, pl.DataType],
) -> None:
    root.mkdir(parents=True, exist_ok=True)
    data_schema = {name: dtype for name, dtype in schema.items() if name not in {"year", "month"}}

    partitions: dict[tuple[int, int | None], list[dict[str, Any]]] = {}
    for row in rows:
        year = row.get("year")
        if year is None:
            msg = "Partitioned sync_refs test rows must include a year."
            raise ValueError(msg)
        key = (int(year), int(row["month"]) if row.get("month") is not None else None)
        partitions.setdefault(key, []).append(
            {name: value for name, value in row.items() if name not in {"year", "month"}}
        )

    for (year, month), part_rows in partitions.items():
        partition_dir = root / f"year={year}"
        if month is not None:
            partition_dir /= f"month={month}"
        write_parquet(partition_dir / "0.parquet", part_rows, data_schema)

def collect_rows(
    frame: pl.DataFrame | pl.LazyFrame,
    *,
    sort_by: Sequence[str] | None = None,
) -> list[dict[str, Any]]:
    data = frame.collect() if isinstance(frame, pl.LazyFrame) else frame
    if sort_by:
        data = data.sort(list(sort_by))
    return data.to_dicts()

def setup_ref_sync_dir(
    base_dir: Path,
    *,
    pages_rows: list[dict[str, Any]] | None = None,
    tasks_rows: list[dict[str, Any]] | None = None,
    page_metrics_rows: list[dict[str, Any]] | None = None,
    page_metrics_partitioned_rows: list[dict[str, Any]] | None = None,
    readability_rows: list[dict[str, Any]] | None = None,
    feedback_rows: list[dict[str, Any]] | None = None,
    calldrivers_rows: list[dict[str, Any]] | None = None,
    activity_map_rows: list[dict[str, Any]] | None = None,
    activity_map_partitioned_rows: list[dict[str, Any]] | None = None,
    gsc_searchterms_rows: list[dict[str, Any]] | None = None,
    gsc_searchterms_partitioned_rows: list[dict[str, Any]] | None = None,
    aa_searchterms_rows: list[dict[str, Any]] | None = None,
    aa_searchterms_partitioned_rows: list[dict[str, Any]] | None = None,
) -> Path:
    write_parquet(base_dir / Pages.parquet_filename, pages_rows or [], PAGES_SCHEMA)
    write_parquet(base_dir / Tasks.parquet_filename, tasks_rows or [], TASKS_SCHEMA)
    write_parquet(base_dir / Readability.parquet_filename, readability_rows or [], READABILITY_SCHEMA)
    write_parquet(base_dir / Feedback.parquet_filename, feedback_rows or [], PAGE_REF_SCHEMA)
    write_parquet(base_dir / Calldrivers.parquet_filename, calldrivers_rows or [], CALLDRIVERS_SCHEMA)

    if page_metrics_partitioned_rows is not None:
        write_partitioned_dataset(
            base_dir / PageMetrics.parquet_filename,
            page_metrics_partitioned_rows,
            PAGE_REF_WITH_UX_SCHEMA,
        )
    else:
        write_parquet(base_dir / PageMetrics.parquet_filename, page_metrics_rows or [], PAGE_REF_WITH_UX_SCHEMA)

    if activity_map_partitioned_rows is not None:
        write_partitioned_dataset(base_dir / ActivityMap.parquet_filename, activity_map_partitioned_rows, PAGE_REF_SCHEMA)
    else:
        write_parquet(
            base_dir / ActivityMap.parquet_filename,
            activity_map_rows or [],
            PAGE_REF_SCHEMA,
        )

    if gsc_searchterms_partitioned_rows is not None:
        write_partitioned_dataset(base_dir / GSCSearchTerms.parquet_filename, gsc_searchterms_partitioned_rows, PAGE_REF_SCHEMA)
    else:
        write_parquet(base_dir / GSCSearchTerms.parquet_filename, gsc_searchterms_rows or [], PAGE_REF_SCHEMA)

    if aa_searchterms_partitioned_rows is not None:
        write_partitioned_dataset(
            base_dir / AASearchTerms.parquet_filename,
            aa_searchterms_partitioned_rows,
            PAGE_REF_SCHEMA,
        )
    else:
        write_parquet(
            base_dir / AASearchTerms.parquet_filename,
            aa_searchterms_rows or [],
            PAGE_REF_SCHEMA,
        )

    return base_dir

def make_ref_sync_context(base_dir: Path) -> RefSyncContext:
    return RefSyncContext(str(base_dir))

def make_mongo_parquet_stub(collection_models: list[Any]) -> MongoParquet:
    mongo_parquet = object.__new__(MongoParquet)
    mongo_parquet.collection_models = collection_models
    return mongo_parquet
