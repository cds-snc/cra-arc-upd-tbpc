import polars as pl
import pytest
from pathlib import Path
from typing import Any, cast

from ..readability import ReadabilityModel
from .sync_refs_test_utils import (
    example_url,
    make_ref_sync_context,
    oid,
    setup_ref_sync_dir,
)


def make_model(tmp_path: Path) -> ReadabilityModel:
    return ReadabilityModel(cast(Any, {"readability": object()}), str(tmp_path))


def test_get_ref_changes_returns_empty_when_readability_refs_match(tmp_path: Path):
    page_id = oid(1)
    _ = setup_ref_sync_dir(
        tmp_path,
        pages_rows=[
            {"_id": page_id, "url": example_url("alpha"), "tasks": [], "projects": []}
        ],
        readability_rows=[
            {"_id": oid(100), "url": example_url("alpha"), "page": page_id}
        ],
        page_metrics_rows=[
            {
                "_id": oid(200),
                "url": example_url("alpha"),
                "page": page_id,
                "tasks": [],
                "projects": [],
                "ux_tests": [],
            }
        ],
    )

    ref_changes = make_model(tmp_path).get_ref_changes(make_ref_sync_context(tmp_path))

    assert ref_changes.is_empty()


def test_get_ref_changes_returns_changed_and_removed_readability_refs(tmp_path: Path):
    current_page_id = oid(1)
    stale_page_id = oid(2)
    missing_page_id = oid(3)
    _ = setup_ref_sync_dir(
        tmp_path,
        pages_rows=[
            {
                "_id": current_page_id,
                "url": example_url("alpha"),
                "tasks": [],
                "projects": [],
            }
        ],
        readability_rows=[
            {"_id": oid(100), "url": example_url("alpha"), "page": stale_page_id},
            {"_id": oid(101), "url": example_url("missing"), "page": missing_page_id},
        ],
        page_metrics_rows=[
            {
                "_id": oid(200),
                "url": example_url("alpha"),
                "page": current_page_id,
                "tasks": [],
                "projects": [],
                "ux_tests": [],
            }
        ],
    )

    ref_changes = make_model(tmp_path).get_ref_changes(make_ref_sync_context(tmp_path))
    actual = {row["url"]: row["page"] for row in ref_changes.to_dicts()}

    assert actual == {
        example_url("alpha"): current_page_id,
        example_url("missing"): None,
    }


def test_sync_refs_raises_when_changed_readability_rows_require_updates(tmp_path: Path):
    current_page_id = oid(1)
    stale_page_id = oid(2)
    _ = setup_ref_sync_dir(
        tmp_path,
        pages_rows=[
            {
                "_id": current_page_id,
                "url": example_url("alpha"),
                "tasks": [],
                "projects": [],
            }
        ],
        readability_rows=[
            {"_id": oid(100), "url": example_url("alpha"), "page": stale_page_id}
        ],
        page_metrics_rows=[
            {
                "_id": oid(200),
                "url": example_url("alpha"),
                "page": current_page_id,
                "tasks": [],
                "projects": [],
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
