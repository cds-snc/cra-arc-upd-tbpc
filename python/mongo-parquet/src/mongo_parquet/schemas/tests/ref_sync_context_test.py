from pathlib import Path

from .sync_refs_test_utils import (
    collect_rows,
    example_url,
    make_ref_sync_context,
    oid,
    setup_ref_sync_dir,
)


def test_ref_sync_context_derives_pages_and_task_mappings(tmp_path: Path):
    _ = setup_ref_sync_dir(
        tmp_path,
        pages_rows=[
            {
                "_id": oid(1),
                "url": example_url("alpha"),
                "tasks": [oid(10), oid(11)],
                "projects": [oid(30)],
            },
            {
                "_id": oid(2),
                "url": example_url("beta"),
                "tasks": [oid(12)],
                "projects": [oid(31)],
            },
        ],
        tasks_rows=[
            {
                "_id": oid(10),
                "tpc_ids": [101, 102],
                "projects": [oid(30)],
                "gc_tasks": [{"title": "GC A"}, {"title": "GC Shared"}],
            },
            {
                "_id": oid(11),
                "tpc_ids": [101],
                "projects": [oid(32)],
                "gc_tasks": [{"title": "GC Shared"}],
            },
            {
                "_id": oid(12),
                "tpc_ids": [103],
                "projects": [oid(31)],
                "gc_tasks": [{"title": "GC B"}],
            },
        ],
        page_metrics_rows=[
            {
                "_id": oid(100),
                "url": example_url("alpha"),
                "page": oid(1),
                "tasks": [oid(10), oid(11)],
                "projects": [oid(30)],
                "ux_tests": [],
            }
        ],
    )

    context = make_ref_sync_context(tmp_path)

    assert collect_rows(context.pages, sort_by=["_id"]) == [
        {
            "_id": oid(1),
            "url": example_url("alpha"),
            "tasks": [oid(10), oid(11)],
            "projects": [oid(30)],
        },
        {
            "_id": oid(2),
            "url": example_url("beta"),
            "tasks": [oid(12)],
            "projects": [oid(31)],
        },
    ]
    assert collect_rows(context.tasks_by_tpc_id, sort_by=["tpc_id"]) == [
        {"tpc_id": 101, "tasks": [oid(10), oid(11)], "projects": [oid(30), oid(32)]},
        {"tpc_id": 102, "tasks": [oid(10)], "projects": [oid(30)]},
        {"tpc_id": 103, "tasks": [oid(12)], "projects": [oid(31)]},
    ]
    assert collect_rows(context.tasks_by_gc_task, sort_by=["gc_task"]) == [
        {"gc_task": "GC A", "tasks": [oid(10)]},
        {"gc_task": "GC B", "tasks": [oid(12)]},
        {"gc_task": "GC Shared", "tasks": [oid(10), oid(11)]},
    ]


def test_ref_sync_context_page_url_enum_combines_urls_from_all_sources(tmp_path: Path):
    _ = setup_ref_sync_dir(
        tmp_path,
        pages_rows=[
            {
                "_id": oid(1),
                "url": example_url("pages"),
                "tasks": [],
                "projects": [],
            }
        ],
        page_metrics_rows=[
            {
                "_id": oid(100),
                "url": example_url("metrics"),
                "page": oid(1),
                "tasks": [],
                "projects": [],
                "ux_tests": [],
            }
        ],
        activity_map_rows=[
            {
                "_id": oid(101),
                "url": example_url("activity"),
                "page": oid(1),
                "tasks": [],
                "projects": [],
            }
        ],
        gsc_searchterms_rows=[
            {
                "_id": oid(102),
                "url": example_url("gsc"),
                "page": oid(1),
                "tasks": [],
                "projects": [],
            }
        ],
        feedback_rows=[
            {
                "_id": oid(103),
                "url": example_url("feedback"),
                "page": oid(1),
                "tasks": [],
                "projects": [],
            }
        ],
        readability_rows=[
            {
                "_id": oid(104),
                "url": example_url("readability"),
                "page": oid(1),
            }
        ],
    )

    categories = list(make_ref_sync_context(tmp_path).page_urls_enum.categories)

    assert set(categories) == {
        example_url("activity"),
        example_url("feedback"),
        example_url("gsc"),
        example_url("metrics"),
        example_url("pages"),
        example_url("readability"),
    }
