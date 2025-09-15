from logging import warning
import os
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv
from pymongo.database import Database
from mongo_parquet import MongoParquet, MongoConfig, SamplingContext, StorageClient


def main():
    import argparse
    from datetime import datetime

    timer_start = datetime.now()
    print(f"🕒 Starting script at {timer_start.strftime('%Y-%m-%d %H:%M:%S')}")

    def timer_end():
        time_end = datetime.now()
        print(f"✅ completed in {(time_end - timer_start).total_seconds()} seconds.")

    dotenv_path = os.path.join(os.path.dirname(__file__), "../../../../.env")

    load_dotenv(dotenv_path)

    if not os.path.exists(dotenv_path):
        print(
            f"⚠️ WARNING: .env file not found at {dotenv_path}. Using default configuration."
        )

    parser = argparse.ArgumentParser(description="MongoDB ↔ Parquet utility tool")
    parser.add_argument(
        "--sample",
        action="store_true",
        help="Export a sample of data from MongoDB to Parquet files.",
    )

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
        "--remote-container",
        type=str,
        help="Override the container to use for remote storage.",
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
        "--sample-dir",
        type=str,
        help="Override the sample directory for remote storage.",
    )

    parser.add_argument(
        "--data-dir",
        type=str,
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

    parser.add_argument(
        "--include",
        type=str,
        nargs="+",
        help="List of collections to include in the import/export.",
    )

    parser.add_argument(
        "--exclude",
        type=str,
        nargs="+",
        help="List of collections to exclude from the import/export.",
    )

    parser.add_argument(
        "--min-date",
        type=str,
        help="Minimum date for filtering documents to use when importing. (YYYY-MM-DD format)",
    )

    parser.add_argument(
        "--drop",
        action="store_true",
        help="Drop the collection before importing data.",
    )

    args = parser.parse_args()

    if args.include and args.exclude:
        print("⚠️ Cannot specify both include and exclude lists. Use one or the other.")
        return

    actions_selected = 0
    if args.export_from_mongo:
        actions_selected += 1
    if args.import_to_mongo:
        actions_selected += 1
    if args.upload_to_remote:
        actions_selected += 1
    if args.download_from_remote:
        actions_selected += 1

    if actions_selected == 0:
        print(
            "No action specified. Use --export-from-mongo, --import-to-mongo, --upload-to-remote, or --download-from-remote."
        )
        print("Use --help for more information.")
        return

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

    if args.storage not in ["azure", "s3"]:
        print("Invalid storage type. Use 'azure' or 's3'.")
        return

    if args.drop and not args.import_to_mongo:
        warning(
            "--drop flag is only applicable with --import-to-mongo. Ignoring --drop."
        )

    db_name = args.db_name or "upd-test"
    sample_dir = args.sample_dir or "sample"
    data_dir = args.data_dir or "data"

    storage_client = StorageClient(
        data_dir=data_dir,
        sample_dir=sample_dir,
        remote_storage_type=args.storage,
    )

    mongo_config = MongoConfig(
        db_name=db_name,
    )

    mp = MongoParquet(
        mongo_config=mongo_config,
        storage_client=storage_client,
        sample=args.sample,
    )

    setup_sampling_context(
        db=mp.io.db.db,
        sampling_context=mp.sampling_context,
    )

    if args.export_from_mongo:
        mp.export_from_mongo(include=args.include, exclude=args.exclude)
        if args.upload_to_remote:
            mp.upload_to_remote()

        timer_end()
        return

    if args.import_to_mongo:
        if args.drop:
            drop_collections(mp.io.db.db)

        mp.import_to_mongo(
            remote=args.from_remote,
            include=args.include,
            exclude=args.exclude,
            min_date=datetime.fromisoformat(args.min_date) if args.min_date else None,
        )
        timer_end()
        return

    if args.upload_to_remote:
        mp.upload_to_remote()
        timer_end()
        return

    if args.download_from_remote:
        mp.download_from_remote(include=args.include, exclude=args.exclude)
        timer_end()
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


def setup_sampling_context(db: Database, sampling_context: SamplingContext):
    """
    Set up the sampling context with data that can be used for sampling.

    :param db: The MongoDB database instance.
    :param sampling_context: The SamplingContext instance to update.
    """

    print("🔍 Fetching sampling context data...")

    def get_sampling_context(_):
        project_ids = [
            ObjectId("64bb7ea337b9d8195e3b441d"),
            ObjectId("621d280492982ac8c344d372"),
            ObjectId("632c6dda259d340af9c37199"),
        ]
        task_ids = [
            task["_id"] for task in db.tasks.find({"projects": {"$in": project_ids}})
        ]
        page_ids = [page["_id"] for page in db.pages.find({"tasks": {"$in": task_ids}})]

        return {
            "project_ids": project_ids,
            "task_ids": task_ids,
            "page_ids": page_ids,
            "date_range": {
                "start": datetime(2024, 1, 1),
            },
        }

    sampling_context.update_context(get_sampling_context)


# doesn't actually drop collections, just empties them, to avoid deleting indexes
def drop_collections(db: Database):
    for collection_name in db.list_collection_names():
        print(f"Emptying collection '{collection_name}'...")
        db[collection_name].delete_many({})
        print(f"Collection '{collection_name}' successfully emptied.")


if __name__ == "__main__":
    main()
