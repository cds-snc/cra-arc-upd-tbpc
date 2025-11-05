"""
mongo_parquet package

This package provides utilities for working with MongoDB and converting data to Parquet format.
"""

import datetime
from typing import Any, final
from pymongo.collection import Collection
from pymongo.database import Database
from .io import MongoParquetIO
from .mongo import MongoConfig
from .sampling import SamplingContext
from .schemas import collection_models, MongoCollection
from .storage import StorageClient
from . import schemas
from .utils import SyncUtils
from .views import ViewService


def get_collection_models(
    db: Database[Any], parquet_dir_path: str
) -> list[MongoCollection]:
    """
    Get all collection models defined in the schemas module, initialized.

    :return: List of collection models.
    """
    return [model(db, parquet_dir_path) for model in collection_models]


@final
class MongoParquet:
    from typing import Any, Callable

    """
    Main class to handle MongoDB to Parquet conversion and storage.
    """

    def __init__(
        self,
        mongo_config: MongoConfig,
        storage_client: StorageClient,
        sample: bool = True,
        sampling_context: SamplingContext | None = None,
    ):
        """
        Initialize MongoParquet with IO and sampling context.

        :param mongo_config: Configuration for MongoDB connection.
        :param storage_client: Client for handling storage operations.
        """
        self.mongo_config = mongo_config
        self.storage_client = storage_client

        self.sample = sample
        self.sampling_context = sampling_context or SamplingContext()

        self.io = MongoParquetIO(mongo_config, storage_client, self.sampling_context)

        self.collection_models = get_collection_models(
            self.io.db.db,
            self.io.storage.target_dirpath(sample=self.sample, remote=False),
        )

    def setup_sampling_context(
        self, callable: Callable[[dict[str, Any]], dict[str, Any]]
    ):
        """
        Set up the sampling context with a callable function that returns a dictionary.

        :param callable: A function that takes a MongoDB client and the current context and updates it.
        """
        self.sampling_context.update_context(callable)

    def should_export(self, model: MongoCollection) -> bool:
        """
        Check whether the collection has data to export

        :param model: The MongoDB collection model.
        :return: True if the collection should be exported, False otherwise.
        """
        collection: Collection[Any] = self.io.db.db[model.collection]
        data = collection.find_one()
        return data is not None

    def export_from_mongo(
        self,
        sample: bool | None = None,
        include: list[str] | None = None,
        exclude: list[str] | None = None,
    ):
        """
        Export data from MongoDB to Parquet format.

        :param sample: Whether to export sample data.
        :param include: List of collections to include in the export.
        :param exclude: List of collections to exclude from the export.
        """
        for model in self.collection_models:
            if include and model.collection not in include:
                print(f"Skipping {model.collection} (not in include list)")
                continue

            if exclude and model.collection in exclude:
                print(f"Skipping {model.collection} (in exclude list)")
                continue

            if not self.should_export(model):
                print(f"Collection {model.collection} has no data, skipping export.")
                continue

            self.io.export_to_parquet(
                model,
                sample=sample or self.sample,
            )

    def upload_to_remote(
        self,
        filepaths: list[str] | None = None,
        sample: bool | None = None,
        cleanup_local: bool = False,
    ):
        """
        Upload Parquet files to remote storage.

        :param filepaths: List of specific file paths to upload, relative to the src directory.
        :param sample: Whether to upload sample files.
        :param cleanup_local: Whether to delete local files after upload.
        """
        self.storage_client.upload_to_remote(
            filepaths=filepaths,
            sample=sample or self.sample,
            cleanup_local=cleanup_local,
        )

    def import_to_mongo(
        self,
        sample: bool | None = None,
        remote: bool | None = None,
        include: list[str] | None = None,
        exclude: list[str] | None = None,
        min_date: datetime.datetime | None = None,
    ):
        """
        Import data from Parquet files back to MongoDB.

        :param sample: Whether to import sample data.
        :param remote: Whether to import from remote storage.
        :param include: List of collections to include in the import.
        :param exclude: List of collections to exclude from the import.
        """
        if include and exclude:
            raise ValueError(
                "Cannot specify both include and exclude lists. Use one or the other."
            )

        for model in self.collection_models:
            if include and model.collection not in include:
                print(f"Skipping {model.collection} (not in include list)")
                continue

            if exclude and model.collection in exclude:
                print(f"Skipping {model.collection} (in exclude list)")
                continue

            self.io.import_from_parquet(
                model,
                sample=sample or self.sample,
                remote=remote or False,
                min_date=min_date,
            )

    def download_from_remote(
        self,
        sample: bool | None = None,
        include: list[str] | None = None,
        exclude: list[str] | None = None,
    ):
        """
        Download Parquet files from remote storage.

        :param sample: Whether to download sample files.
        """
        parquet_models = [
            [model.primary_model, *model.secondary_models]
            for model in self.collection_models
            if (not include or model.collection in include)
            and (not exclude or model.collection not in exclude)
        ]

        filenames = [
            parquet_model.parquet_filename
            for collection_models in parquet_models
            for parquet_model in collection_models
        ]

        self.storage_client.download_from_remote(
            filenames, sample=sample or self.sample
        )

    def bail_if_empty(self):
        """
        Check if the MongoDB database has any data.
        If no collections have data, raise an error to prevent further operations.

        Hard-coded to only check `pages_metrics`.
        """
        if self.io.db.db["pages_metrics"].estimated_document_count() == 0:
            raise ValueError("MongoDB database is empty.")

    def sync_parquet_with_mongo(
        self,
        sample: bool | None = None,
        include: list[str] | None = None,
        exclude: list[str] | None = None,
        upload_on_success: bool = False,
        cleanup_temp_dir: bool = False,
    ):
        """
        Sync Parquet files with MongoDB by exporting fresh versions of smaller collections,
        using incremental updates for larger collections, as well as ensuring referential integrity.

        :param sample: Whether to use sample data.
        :param include: List of collections to include in the sync.
        :param exclude: List of collections to exclude from the sync.
        """

        self.bail_if_empty()

        root_dir_path = self.storage_client.target_dirpath(
            sample=sample or self.sample, remote=False
        )

        sync_utils = SyncUtils(root_dir_path)

        for model in self.collection_models:
            if include and model.collection not in include:
                print(f"Skipping {model.collection} (not in include list)")
                continue

            if exclude and model.collection in exclude:
                print(f"Skipping {model.collection} (in exclude list)")
                continue

            if not self.should_export(model):
                print(f"Collection {model.collection} has no data, skipping export.")
                continue

            if model.sync_type == "simple":
                print(f"Performing simple sync for {model.collection}")
                self.io.export_to_parquet(
                    model,
                    sample=sample or self.sample,
                )
                if upload_on_success:
                    for parquet_model in [model.primary_model, *model.secondary_models]:
                        target_filepath = self.storage_client.target_filepath(
                            parquet_model.parquet_filename,
                            sample=sample or False,
                            remote=False,
                        )
                        sync_utils.queue_upload_if_changed(target_filepath)

            elif model.sync_type == "incremental":
                try:
                    self.io.sync_incremental_parquet(
                        model,
                        sync_utils,
                        sample=sample or self.sample,
                        cleanup_temp_dir=cleanup_temp_dir,
                    )
                except Exception as e:
                    print(f"Error occurred while syncing {model.collection}: {e}")

        if upload_on_success and len(sync_utils.upload_queue) > 0:
            print(f"Uploading {len(sync_utils.upload_queue)} updated files...")
            self.storage_client.upload_to_remote(
                sample=sample or False,
                cleanup_local=False,
                filepaths=sync_utils.upload_queue,
            )

        sync_utils.upload_queue.clear()

    def recalculate_views(self, cleanup_temp_dir: bool = False):
        """
        Recalculate MongoDB materialized views to ensure they reflect the latest data.
        """
        view_service = ViewService(
            self.io.db.db,
            self.storage_client.target_dirpath(sample=self.sample, remote=False),
            ".views_temp",
        )
        view_service.recalculate_pages_view()
        view_service.recalculate_tasks_view()

        if cleanup_temp_dir:
            view_service.utils.cleanup_temp_dir()


__all__ = [
    "collection_models",
    "get_collection_models",
    "MongoCollection",
    "MongoConfig",
    "MongoParquet",
    "MongoParquetIO",
    "SamplingContext",
    "StorageClient",
    "schemas",
]
