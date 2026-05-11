import polars as pl
from pathlib import Path
from typing import Any, cast

from ..page_metrics import PagesMetricsModel
from .sync_refs_test_utils import (
    collect_rows,
    example_url,
    make_ref_sync_context,
    oid,
    setup_ref_sync_dir,
)


def make_model(tmp_path: Path) -> PagesMetricsModel:
    return PagesMetricsModel(cast(Any, {"pages_metrics": object()}), str(tmp_path))


def test_get_ref_changes_returns_changed_and_removed_page_metric_refs(tmp_path: Path):
    current_page_id = oid(1)
    current_task_id = oid(10)
    current_project_id = oid(20)
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
        page_metrics_rows=[
            {
                "_id": oid(100),
                "url": example_url("alpha"),
                "page": oid(2),
                "tasks": [oid(11)],
                "projects": [oid(21)],
                "ux_tests": [],
            },
            {
                "_id": oid(101),
                "url": example_url("missing"),
                "page": oid(3),
                "tasks": [oid(12)],
                "projects": [oid(22)],
                "ux_tests": [],
            },
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


def test_sync_refs_preserves_existing_page_metric_refs_while_skipping_missing_secondary_partitions(
    tmp_path: Path,
):
    current_page_id = oid(1)
    updated_task_id = oid(10)
    updated_project_id = oid(20)
    stale_page_id = oid(2)
    stale_task_id = oid(11)
    stale_project_id = oid(21)

    changed_partition_rows = [
        {
            "year": 2024,
            "month": 1,
            "_id": oid(100),
            "url": example_url("alpha"),
            "page": stale_page_id,
            "tasks": [stale_task_id],
            "projects": [stale_project_id],
            "ux_tests": [],
        },
        {
            "year": 2024,
            "month": 2,
            "_id": oid(101),
            "url": example_url("beta"),
            "page": oid(3),
            "tasks": [oid(12)],
            "projects": [oid(22)],
            "ux_tests": [],
        },
    ]

    _ = setup_ref_sync_dir(
        tmp_path,
        pages_rows=[
            {
                "_id": current_page_id,
                "url": example_url("alpha"),
                "tasks": [updated_task_id],
                "projects": [updated_project_id],
            },
            {
                "_id": oid(3),
                "url": example_url("beta"),
                "tasks": [oid(12)],
                "projects": [oid(22)],
            },
        ],
        page_metrics_partitioned_rows=changed_partition_rows,
        aa_searchterms_partitioned_rows=[
            {
                "year": 2024,
                "month": 1,
                "_id": oid(100),
                "url": example_url("alpha"),
                "page": stale_page_id,
                "tasks": [stale_task_id],
                "projects": [stale_project_id],
            }
        ],
        gsc_searchterms_partitioned_rows=[
            {
                "year": 2024,
                "month": 1,
                "_id": oid(100),
                "url": example_url("alpha"),
                "page": stale_page_id,
                "tasks": [stale_task_id],
                "projects": [stale_project_id],
            }
        ],
    )
    model = make_model(tmp_path)

    model.sync_refs(make_ref_sync_context(tmp_path))

    primary_january = tmp_path / model.primary_model.get_partition_file_path(
        {"year": 2024, "month": 1}
    )
    primary_february = tmp_path / model.primary_model.get_partition_file_path(
        {"year": 2024, "month": 2}
    )
    aa_january = tmp_path / model.secondary_models[0].get_partition_file_path(
        {"year": 2024, "month": 1}
    )
    gsc_january = tmp_path / model.secondary_models[2].get_partition_file_path(
        {"year": 2024, "month": 1}
    )
    missing_activity_map = tmp_path / model.secondary_models[1].get_partition_file_path(
        {"year": 2024, "month": 1}
    )

    assert collect_rows(pl.read_parquet(primary_january)) == [
        {
            "_id": oid(100),
            "url": example_url("alpha"),
            "page": stale_page_id,
            "tasks": [stale_task_id],
            "projects": [stale_project_id],
            "ux_tests": [],
            "page_right": current_page_id,
            "tasks_right": [updated_task_id],
            "projects_right": [updated_project_id],
        }
    ]
    assert collect_rows(pl.read_parquet(primary_february)) == [
        {
            "_id": oid(101),
            "url": example_url("beta"),
            "page": oid(3),
            "tasks": [oid(12)],
            "projects": [oid(22)],
            "ux_tests": [],
        }
    ]
    assert collect_rows(pl.read_parquet(aa_january)) == [
        {
            "_id": oid(100),
            "url": example_url("alpha"),
            "page": stale_page_id,
            "tasks": [stale_task_id],
            "projects": [stale_project_id],
            "page_right": current_page_id,
            "tasks_right": [updated_task_id],
            "projects_right": [updated_project_id],
        }
    ]
    assert collect_rows(pl.read_parquet(gsc_january)) == [
        {
            "_id": oid(100),
            "url": example_url("alpha"),
            "page": stale_page_id,
            "tasks": [stale_task_id],
            "projects": [stale_project_id],
            "page_right": current_page_id,
            "tasks_right": [updated_task_id],
            "projects_right": [updated_project_id],
        }
    ]
    assert not missing_activity_map.exists()
