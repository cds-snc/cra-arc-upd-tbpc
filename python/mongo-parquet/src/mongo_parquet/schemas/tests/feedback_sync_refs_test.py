import polars as pl
import pytest
from pathlib import Path
from typing import Any, cast

from ..feedback import FeedbackModel
from .sync_refs_test_utils import (
    example_url,
    make_ref_sync_context,
    oid,
    setup_ref_sync_dir,
)


def make_model(tmp_path: Path) -> FeedbackModel:
    return FeedbackModel(cast(Any, {"feedback": object()}), str(tmp_path))


def test_get_ref_changes_returns_empty_when_feedback_refs_match(tmp_path: Path):
    page_id = oid(1)
    task_id = oid(10)
    project_id = oid(20)
    _ = setup_ref_sync_dir(
        tmp_path,
        pages_rows=[
            {
                "_id": page_id,
                "url": example_url("alpha"),
                "tasks": [task_id],
                "projects": [project_id],
            }
        ],
        feedback_rows=[
            {
                "_id": oid(100),
                "url": example_url("alpha"),
                "page": page_id,
                "tasks": [task_id],
                "projects": [project_id],
            }
        ],
        page_metrics_rows=[
            {
                "_id": oid(200),
                "url": example_url("alpha"),
                "page": page_id,
                "tasks": [task_id],
                "projects": [project_id],
                "ux_tests": [],
            }
        ],
    )

    ref_changes = make_model(tmp_path).get_ref_changes(make_ref_sync_context(tmp_path))

    assert ref_changes.is_empty()


def test_get_ref_changes_returns_changed_and_removed_feedback_refs(tmp_path: Path):
    current_page_id = oid(1)
    stale_page_id = oid(2)
    current_task_id = oid(10)
    stale_task_id = oid(11)
    current_project_id = oid(20)
    stale_project_id = oid(21)
    _ = setup_ref_sync_dir(
        tmp_path,
        pages_rows=[
            {
                "_id": current_page_id,
                "url": example_url("alpha"),
                "tasks": [current_task_id],
                "projects": [current_project_id],
            }
        ],
        feedback_rows=[
            {
                "_id": oid(100),
                "url": example_url("alpha"),
                "page": stale_page_id,
                "tasks": [stale_task_id],
                "projects": [stale_project_id],
            },
            {
                "_id": oid(101),
                "url": example_url("missing"),
                "page": oid(3),
                "tasks": [oid(12)],
                "projects": [oid(22)],
            },
        ],
        page_metrics_rows=[
            {
                "_id": oid(200),
                "url": example_url("alpha"),
                "page": current_page_id,
                "tasks": [current_task_id],
                "projects": [current_project_id],
                "ux_tests": [],
            }
        ],
    )

    ref_changes = make_model(tmp_path).get_ref_changes(make_ref_sync_context(tmp_path))
    actual = {
        row["url"]: {
            "page": row["page"],
            "tasks": row["tasks"],
            "projects": row["projects"],
        }
        for row in ref_changes.to_dicts()
    }

    assert actual == {
        example_url("alpha"): {
            "page": current_page_id,
            "tasks": [current_task_id],
            "projects": [current_project_id],
        },
        example_url("missing"): {
            "page": None,
            "tasks": None,
            "projects": None,
        },
    }


def test_sync_refs_raises_when_changed_feedback_rows_require_updates(tmp_path: Path):
    current_page_id = oid(1)
    _ = setup_ref_sync_dir(
        tmp_path,
        pages_rows=[
            {
                "_id": current_page_id,
                "url": example_url("alpha"),
                "tasks": [oid(10)],
                "projects": [oid(20)],
            }
        ],
        feedback_rows=[
            {
                "_id": oid(100),
                "url": example_url("alpha"),
                "page": oid(2),
                "tasks": [oid(11)],
                "projects": [oid(21)],
            }
        ],
        page_metrics_rows=[
            {
                "_id": oid(200),
                "url": example_url("alpha"),
                "page": current_page_id,
                "tasks": [oid(10)],
                "projects": [oid(20)],
                "ux_tests": [],
            }
        ],
    )
    model = make_model(tmp_path)
    file_path = model.primary_model.get_file_path()
    before = pl.read_parquet(file_path).to_dicts()

    with pytest.raises(pl.exceptions.SchemaError):
        model.sync_refs(make_ref_sync_context(tmp_path))

    assert pl.read_parquet(file_path).to_dicts() == before
