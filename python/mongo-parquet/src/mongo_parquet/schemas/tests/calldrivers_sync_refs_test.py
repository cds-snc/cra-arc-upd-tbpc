from pathlib import Path
from typing import Any, cast

import polars as pl

from ..calldrivers import CalldriverModel
from .sync_refs_test_utils import (
    collect_rows,
    make_ref_sync_context,
    oid,
    setup_ref_sync_dir,
)


def make_model(tmp_path: Path) -> CalldriverModel:
    return CalldriverModel(cast(Any, {"calldrivers": object()}), str(tmp_path))


def test_get_ref_changes_returns_empty_when_calldriver_refs_match(tmp_path: Path):
    _ = setup_ref_sync_dir(
        tmp_path,
        tasks_rows=[
            {
                "_id": oid(1),
                "tpc_ids": [101],
                "projects": [oid(20)],
                "gc_tasks": [],
            }
        ],
        calldrivers_rows=[
            {
                "_id": oid(100),
                "tpc_id": 101,
                "tasks": [oid(1)],
                "projects": [oid(20)],
            }
        ],
    )

    ref_changes = make_model(tmp_path).get_ref_changes(make_ref_sync_context(tmp_path))

    assert ref_changes.is_empty()


def test_get_ref_changes_returns_changed_and_removed_calldriver_refs(tmp_path: Path):
    _ = setup_ref_sync_dir(
        tmp_path,
        tasks_rows=[
            {
                "_id": oid(1),
                "tpc_ids": [101],
                "projects": [oid(20)],
                "gc_tasks": [],
            },
            {
                "_id": oid(2),
                "tpc_ids": [101],
                "projects": [oid(21)],
                "gc_tasks": [],
            },
        ],
        calldrivers_rows=[
            {
                "_id": oid(100),
                "tpc_id": 101,
                "tasks": [oid(1)],
                "projects": [oid(20)],
            },
            {
                "_id": oid(101),
                "tpc_id": 999,
                "tasks": [oid(9)],
                "projects": [oid(29)],
            },
        ],
    )

    ref_changes = make_model(tmp_path).get_ref_changes(make_ref_sync_context(tmp_path))

    assert collect_rows(ref_changes, sort_by=["tpc_id"]) == [
        {
            "tpc_id": 101,
            "tasks": [oid(1), oid(2)],
            "projects": [oid(20), oid(21)],
        },
        {
            "tpc_id": 999,
            "tasks": None,
            "projects": None,
        },
    ]


def test_sync_refs_updates_changed_calldriver_rows(tmp_path: Path):
    _ = setup_ref_sync_dir(
        tmp_path,
        tasks_rows=[
            {
                "_id": oid(1),
                "tpc_ids": [101],
                "projects": [oid(20)],
                "gc_tasks": [],
            },
            {
                "_id": oid(2),
                "tpc_ids": [101],
                "projects": [oid(21)],
                "gc_tasks": [],
            },
        ],
        calldrivers_rows=[
            {
                "_id": oid(100),
                "tpc_id": 101,
                "tasks": [oid(1)],
                "projects": [oid(20)],
            },
            {
                "_id": oid(101),
                "tpc_id": 102,
                "tasks": [oid(3)],
                "projects": [oid(22)],
            },
        ],
    )
    model = make_model(tmp_path)

    model.sync_refs(make_ref_sync_context(tmp_path))

    assert collect_rows(
        pl.read_parquet(model.primary_model.get_file_path()), sort_by=["tpc_id"]
    ) == [
        {
            "_id": oid(100),
            "tpc_id": 101,
            "tasks": [oid(1)],
            "projects": [oid(20)],
            "tasks_right": [oid(1), oid(2)],
            "projects_right": [oid(20), oid(21)],
        },
        {
            "_id": oid(101),
            "tpc_id": 102,
            "tasks": [oid(3)],
            "projects": [oid(22)],
            "tasks_right": None,
            "projects_right": None,
        },
    ]
