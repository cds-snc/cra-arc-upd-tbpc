import os
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Any, Optional

from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv


class MongoParquet:
    def __init__(
        self,
        mongo_uri: Optional[str] = None,
        db_name: str = "upd-test",
        remote_container="data",
        local_dir="sample",
        data_dir="sample",
        storage="azure",
    ):
        import fsspec

        load_dotenv()

        self.mongo_uri = mongo_uri or os.getenv(
            "MONGO_URI", "mongodb://localhost:27017"
        )
        self.db_name = db_name
        self.client = MongoClient(self.mongo_uri)
        self.db = self.client[self.db_name]
        self.local_dir = local_dir
        self.remote_container = remote_container
        self.data_dir = data_dir
        self.storage = storage

        if self.storage == "azure":
            self.azure_storage_account_name = os.getenv("AZURE_DATA_ACCOUNT_NAME", "")
            self.azure_storage_account_key = os.getenv("AZURE_DATA_ACCOUNT_KEY", "")
            self.azure_connection_string = os.getenv("AZURE_DATA_CONNECTION_STRING", "")
            self.fs = fsspec.filesystem(
                "abfs",
                connection_string=self.azure_connection_string,
            )
            self.pl_storage_options = {
                "azure_storage_account_name": self.azure_storage_account_name,
                "azure_storage_account_key": self.azure_storage_account_key,
            }

        elif self.storage == "s3":
            self.aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID", "")
            self.aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")
            self.region_name = os.getenv("AWS_DEFAULT_REGION", "ca-central-1")

            self.fs = fsspec.filesystem(
                "s3",
                key=self.aws_access_key_id,
                secret=self.aws_secret_access_key,
                client_kwargs={"region_name": self.region_name},
            )

    def export_from_mongo(
        self,
        local_dir: Optional[str] = None,
        db_name: Optional[str] = None,
        upload_to_remote: bool = False,
        remote_container: Optional[str] = None,
        data_dir: Optional[str] = None,
    ):
        from mongo_parquet.mongo import MongoConverter
        from mongo_parquet.schemas import (
            AASearchTerms,
            ActivityMap,
            Calldrivers,
            Feedback,
            GSCSearchTerms,
            GcTss,
            OverallMetrics,
            OverallGSCSearchTerms,
            PageMetrics,
            Pages,
            Projects,
            Tasks,
            Urls,
            UxTests,
            Readability,
            SearchAssessment,
            Reports,
            Annotations,
        )

        db = self.client[db_name] if db_name is not None else self.db
        local_dir = local_dir or self.local_dir
        remote_container = remote_container or self.remote_container
        data_dir = data_dir or self.data_dir

        start_time = datetime.now()
        print("⏳ Starting export...")

        start_date = datetime(2024, 1, 1)
        end_date = datetime.now() - timedelta(days=1)

        print("🔍 Fetching filter references...")

        project_ids = [
            ObjectId("64bb7ea337b9d8195e3b441d"),
            ObjectId("621d280492982ac8c344d372"),
            ObjectId("632c6dda259d340af9c37199"),
        ]

        task_ids = [t["_id"] for t in db.tasks.find({"projects": {"$in": project_ids}})]
        page_ids = [p["_id"] for p in db.pages.find({"tasks": {"$in": task_ids}})]

        @dataclass
        class ExportModel:
            model: Any
            filter: Optional[dict] = None
            date_range: bool = False
            rename: Optional[str] = None

        MODELS = [
            ExportModel(PageMetrics(), {"tasks": {"$in": task_ids}}, True),
            ExportModel(GcTss(), None, True),
            ExportModel(Feedback(), None, True),
            ExportModel(
                AASearchTerms(),
                {"tasks": {"$in": task_ids}},
                True,
                "pages_metrics_aa_searchterms",
            ),
            ExportModel(
                ActivityMap(),
                {"tasks": {"$in": task_ids}},
                True,
                "pages_metrics_activity_map",
            ),
            ExportModel(
                GSCSearchTerms(),
                {"tasks": {"$in": task_ids}},
                True,
                "pages_metrics_gsc_searchterms",
            ),
            ExportModel(Calldrivers(), None, True),
            ExportModel(OverallMetrics(), None, True),
            ExportModel(
                OverallGSCSearchTerms(), None, True, "overall_metrics_gsc_searchterms"
            ),
            ExportModel(Pages(), {"tasks": {"$in": task_ids}}, False),
            ExportModel(Projects(), {"_id": {"$in": project_ids}}, False),
            ExportModel(Tasks(), {"_id": {"$in": task_ids}}, False),
            ExportModel(Urls(), {"page": {"$in": page_ids}}, False),
            ExportModel(UxTests(), {"tasks": {"$in": task_ids}}, False),
            ExportModel(Readability(), {"page": {"$in": page_ids}}, False),
            ExportModel(SearchAssessment(), None, False),
            ExportModel(Reports(), None, False),
            ExportModel(Annotations(), None, False),
        ]

        converter = MongoConverter()

        for item in MODELS:
            if item.filter:
                item.model.filter = item.filter
            if item.date_range:
                item.model.start = start_date
                item.model.end = end_date

            name = item.rename or item.model.collection
            print(f"📦 Exporting: `{name}`...")
            converter.save(
                item.model,
                collection_rename=item.rename,
                output_dir=local_dir or self.local_dir,
            )

        print(f"✅ All exports completed in {datetime.now() - start_time}")

        if upload_to_remote:
            self.upload_to_remote(
                remote_container=remote_container,
                data_dir=data_dir,
                local_dir=local_dir,
            )

    def upload_to_remote(
        self,
        remote_container: Optional[str] = None,
        data_dir: Optional[str] = None,
        local_dir: Optional[str] = None,
    ):
        LOCAL_DIR = local_dir or self.local_dir
        REMOTE_CONTAINER = remote_container or self.remote_container
        DATA_DIR = data_dir or self.data_dir

        print(
            f"☁️ Uploading Parquet files to remote storage `{REMOTE_CONTAINER}/{DATA_DIR}`..."
        )

        for root, _, files in os.walk(LOCAL_DIR):
            for file in files:
                if file.endswith(".parquet"):
                    local_path = os.path.join(root, file)
                    relative_path = os.path.relpath(local_path, LOCAL_DIR)

                    remote_path = os.path.join(DATA_DIR, relative_path)
                    remote_path = os.path.normpath(remote_path)

                    blob_path = f"{REMOTE_CONTAINER}/{remote_path}"
                    # blob_path = blob_path.replace("\\", "/")  # Ensure forward slashes for Azure
                    # blob_path = blob_path.lstrip("/")  # Remove leading slash
                    print(f"⬆️  Uploading: {local_path} → {blob_path}")
                    with open(local_path, "rb") as f:
                        self.fs.pipe_file(blob_path, f.read())

        print("✅ All Parquet files uploaded.")

    def import_to_mongo(
        self,
        use_remote_storage: bool = False,
        remote_container: Optional[str] = None,
        data_dir: Optional[str] = None,
        local_dir: Optional[str] = None,
        db_name: Optional[str] = None,
    ):
        import polars as pl
        from bson import ObjectId
        from pymongoarrow.monkey import patch_all

        patch_all()

        DATA_DIR = data_dir or self.data_dir
        LOCAL_DIR = local_dir or self.local_dir

        print(DATA_DIR)

        db = self.client[db_name or self.db_name]

        def array_to_object(arr):
            if isinstance(arr, list):
                return {
                    item["k"]: item["v"]
                    for item in arr
                    if isinstance(item, dict) and "k" in item and "v" in item
                }
            return arr

        # todo: do this directly in polars
        def convert_objectids(value):
            if isinstance(value, str):
                try:
                    return ObjectId(value)
                except:  # noqa: E722
                    return value
            elif isinstance(value, dict):
                return {k: convert_objectids(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [convert_objectids(item) for item in value]
            return value

        def parse_objectids(row):
            for key in [
                "_id",
                "tasks",
                "page",
                "pages",
                "project",
                "projects",
                "ux_tests",
                "attachments",
                "en_attachment",
                "fr_attachment",
            ]:
                if key in row:
                    row[key] = convert_objectids(row[key])
            return row

        def read_parquet(filepath: str) -> pl.DataFrame:
            print(f"📥 Reading {filepath}...")

            if use_remote_storage:
                with self.fs.open(f"{filepath}", "rb") as f:
                    return pl.read_parquet(f.read())

            return pl.read_parquet(filepath)

        # --- Config for merged collections ---
        IMPORT_CONFIG = {
            "pages_metrics": {
                "base": "pages_metrics.parquet",
                "extensions": [
                    (
                        "pages_metrics_activity_map.parquet",
                        "activity_map",
                        ["link", "clicks"],
                    ),
                    (
                        "pages_metrics_gsc_searchterms.parquet",
                        "gsc_searchterms",
                        ["clicks", "ctr", "impressions", "position", "term"],
                    ),
                    (
                        "pages_metrics_aa_searchterms.parquet",
                        "aa_searchterms",
                        ["term", "clicks", "position"],
                    ),
                ],
            },
            "overall_metrics": {
                "base": "overall_metrics.parquet",
                "extensions": [
                    (
                        "overall_metrics_gsc_searchterms.parquet",
                        "gsc_searchterms",
                        ["clicks", "ctr", "impressions", "position", "term"],
                    ),
                ],
            },
        }

        print(
            f"🚀 Starting import from {'Remote storage' if use_remote_storage else 'Local filesystem'}..."
        )

        files = (
            sorted(self.fs.find(remote_container or self.remote_container))
            if use_remote_storage
            else sorted(
                os.path.join(LOCAL_DIR, f)
                for f in os.listdir(LOCAL_DIR)
                if f.endswith(".parquet")
            )
        )

        base_targets = {}
        skip_files = set()

        for name, cfg in IMPORT_CONFIG.items():
            base_targets[os.path.basename(cfg["base"])] = name
            for ext in cfg["extensions"]:
                skip_files.add(ext[0])

        for filepath in sorted(files):
            base_filename = os.path.basename(filepath)
            is_base_file = base_filename in base_targets

            if not is_base_file and os.path.basename(filepath) in skip_files:
                print(f"⚠️ Skipping {filepath} (used as extension)")
                continue

            collection_name = os.path.splitext(os.path.basename(filepath))[0]

            if is_base_file:
                collection_name = base_targets[base_filename]
                cfg = IMPORT_CONFIG[collection_name]
                print(f"\n📄 Merged load: {filepath} → {collection_name}")

                base_df = read_parquet(filepath)

                for ext_filename, nested_field, struct_fields in cfg["extensions"]:
                    matched = [f for f in files if os.path.basename(f) == ext_filename]
                    if not matched:
                        print(f"⚠️ Missing extension file: {ext_filename}")
                        continue

                    ext_path = matched[0]
                    ext_df = read_parquet(ext_path)

                    if "date" in ext_df.columns:
                        ext_df = ext_df.drop("date")

                    ext_df = ext_df.select(["_id"] + struct_fields)

                    struct_fields = [str(f) for f in struct_fields]

                    ext_df_non_null = ext_df.filter(
                        pl.any_horizontal(
                            [pl.col(f).is_not_null() for f in struct_fields]
                        )
                    )

                    nested = ext_df_non_null.group_by("_id").agg(
                        pl.struct([pl.col(f) for f in struct_fields]).alias(
                            nested_field
                        )
                    )

                    if nested_field in base_df.columns:
                        base_df = base_df.drop(nested_field)

                    base_df = base_df.join(nested, on="_id", how="left")

                df = base_df
            else:
                print(f"\n📂 Standalone load: {filepath} → {collection_name}")
                df = read_parquet(filepath)

            # todo: avoid converting to dicts, use polars directly and use pymongoarrow to insert using arrow tables
            records = []
            for rec in df.to_dicts():
                rec = parse_objectids(rec)

                if os.path.basename(filepath) == "urls.parquet":
                    for field in ["metadata", "langHrefs", "all_titles"]:
                        if field in rec:
                            rec[field] = array_to_object(rec[field])
                elif os.path.basename(filepath) == "pages.parquet":
                    for field in ["metadata"]:
                        if field in rec:
                            rec[field] = array_to_object(rec[field])

                keep_empty_lists = {"attachments"}
                rec = {
                    k: v
                    for k, v in rec.items()
                    if v is not None and (v != [] or k in keep_empty_lists) and v != {}
                }

                records.append(rec)

            collection = db[collection_name]
            existing_ids = set(doc["_id"] for doc in collection.find({}, {"_id": 1}))
            new_records = [doc for doc in records if doc["_id"] not in existing_ids]

            if new_records:
                collection.insert_many(new_records)
                print(f"✅ Inserted {len(new_records)} into `{collection_name}`")
            else:
                print(f"🟡 No new documents to insert into `{collection_name}`")

    def download_from_remote(
        self,
        remote_container: Optional[str] = None,
        data_dir: Optional[str] = None,
        local_dir: Optional[str] = None,
    ):
        LOCAL_DIR = local_dir or self.local_dir
        REMOTE_CONTAINER = remote_container or self.remote_container
        DATA_DIR = data_dir or self.data_dir

        print(
            f"☁️ Downloading Parquet files from remote storage `{REMOTE_CONTAINER}/{DATA_DIR}` → local `{LOCAL_DIR}`..."
        )

        all_files = self.fs.find(f"{REMOTE_CONTAINER}/{DATA_DIR}")

        for remote_path in all_files:
            if not remote_path.endswith(".parquet"):
                continue

            relative_path = os.path.relpath(
                remote_path, f"{REMOTE_CONTAINER}/{DATA_DIR}"
            )
            local_path = os.path.join(LOCAL_DIR, relative_path)

            os.makedirs(os.path.dirname(local_path), exist_ok=True)

            print(f"⬇️  Downloading: {remote_path} → {local_path}")
            with self.fs.open(remote_path, "rb") as remote_file:
                with open(local_path, "wb") as local_file:
                    local_file.write(remote_file.read())  # type: ignore

        print("✅ All Parquet files downloaded.")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="MongoDB ↔ Parquet utility tool")
    parser.add_argument(
        "--export-from-mongo",
        action="store_true",
        help="Export data from MongoDB to Parquet files.",
    )

    parser.add_argument(
        "--import-to-mongo",
        action="store_true",
        help="Import parquet data to MongoDB",
    )

    parser.add_argument(
        "--from-remote",
        action="store_true",
        help="Insert into Mongo directly from remote storage rather than the local filesystem",
    )

    parser.add_argument(
        "--upload-to-remote",
        action="store_true",
        help="Upload data to remote storage",
    )

    parser.add_argument(
        "--download-from-remote",
        action="store_true",
        help="Download data from remote storage",
    )

    parser.add_argument(
        "--local-dir",
        type=str,
        default="sample",
        help="Override local directory for reading/writing Parquet files.",
    )

    parser.add_argument(
        "--remote-container",
        type=str,
        default="data",
        help="Override the container to use for remote storage.",
    )

    parser.add_argument(
        "--data-dir",
        type=str,
        default="sample",
        help="Override the data directory for remote storage.",
    )
    parser.add_argument(
        "--db-name",
        type=str,
        default="upd-test",
        help="Override the database name to use.",
    )

    parser.add_argument(
        "--storage",
        type=str,
        default="azure",
        help="Override the remote storage type (azure or s3).",
    )

    args = parser.parse_args()

    actions_selected = 0
    if args.export_from_mongo:
        actions_selected += 1
    if args.import_to_mongo:
        actions_selected += 1
    if args.upload_to_remote:
        actions_selected += 1
    if args.download_from_remote:
        actions_selected += 1

    if actions_selected > 1:
        # export_from_mongo and upload_to_remote are the only two that can be selected together
        if not (
            actions_selected == 2 and (args.export_from_mongo and args.upload_to_remote)
        ):
            print(
                "⚠️ Multiple actions selected. Only one action can be performed at a time."
            )
            print("Use --help for more information.")
            return

    mongo_parquet = MongoParquet(
        db_name=args.db_name,
        local_dir=args.local_dir,
        remote_container=args.remote_container,
        data_dir=args.data_dir,
        storage=args.storage,
    )

    if args.export_from_mongo:
        mongo_parquet.export_from_mongo(upload_to_remote=args.upload_to_remote)
        return
    if args.import_to_mongo:
        mongo_parquet.import_to_mongo(use_remote_storage=args.from_remote)
        return
    if args.upload_to_remote:
        mongo_parquet.upload_to_remote()
        return
    if args.download_from_remote:
        mongo_parquet.download_from_remote()
        return
    if not (
        args.export_from_mongo
        or args.import_to_mongo
        or args.upload_to_remote
        or args.download_from_remote
    ):
        print(
            "No action specified. Use --export_from_mongo (export), --import_to_mongo (import), or --upload_to_remote (upload), or --download_from_remote (download)."
        )
        print("Use --help for more information.")


if __name__ == "__main__":
    main()
