from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from ... import MongoParquet
from .sync_refs_test_utils import (
    example_url,
    make_mongo_parquet_stub,
    oid,
    setup_ref_sync_dir,
)

def test_sync_refs_currently_never_invokes_collection_sync_methods(tmp_path: Path):
    _ = setup_ref_sync_dir(
        tmp_path,
        pages_rows=[
            {"_id": oid(1), "url": example_url("alpha"), "tasks": [], "projects": []}
        ],
        page_metrics_rows=[
            {
                "_id": oid(100),
                "url": example_url("alpha"),
                "page": oid(1),
                "tasks": [],
                "projects": [],
                "ux_tests": [],
            }
        ],
    )
    ref_model = SimpleNamespace(collection="pages", sync_type="incremental", sync_refs=Mock())
    non_ref_model = SimpleNamespace(collection="feedback", sync_type="incremental", sync_refs=Mock())
    mongo_parquet = make_mongo_parquet_stub([ref_model, non_ref_model])

    MongoParquet.sync_refs(mongo_parquet, str(tmp_path))

    ref_model.sync_refs.assert_not_called()
    non_ref_model.sync_refs.assert_not_called()
