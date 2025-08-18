"""
mongo_parquet package

This package provides utilities for working with MongoDB and converting data to Parquet format.
"""

from pymongo.collection import Collection
from .io import MongoParquetIO
from .mongo import MongoConfig
from .sampling import SamplingContext
from .schemas import collection_models, MongoCollection
from .storage import StorageClient
from . import schemas


def get_collection_models():
    """
    Get all collection models defined in the schemas module, initialized.

    :return: List of collection models.
    """
    return [model() for model in collection_models]


class MongoParquet:
    from typing import Any, Callable, Dict, Optional

    """
    Main class to handle MongoDB to Parquet conversion and storage.
    """

    def __init__(
        self,
        mongo_config: MongoConfig,
        storage_client: StorageClient,
        sample=True,
        sampling_context: SamplingContext = SamplingContext(),
    ):
        """
        Initialize MongoParquet with IO and sampling context.

        :param mongo_config: Configuration for MongoDB connection.
        :param storage_client: Client for handling storage operations.
        """
        self.mongo_config = mongo_config
        self.storage_client = storage_client

        self.sample = sample
        self.sampling_context = sampling_context

        self.io = MongoParquetIO(mongo_config, storage_client, sampling_context)

        self.collection_models = get_collection_models()

    def setup_sampling_context(
        self, callable: Callable[[Dict[str, Any]], Dict[str, Any]]
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
        collection: Collection = self.io.db.db[model.collection]
        data = collection.find_one()
        return data is not None

    def export_from_mongo(
        self,
        sample: Optional[bool] = None,
        include: Optional[list[str]] = None,
        exclude: Optional[list[str]] = None,
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
        self, sample: Optional[bool] = None, cleanup_local: bool = False
    ):
        """
        Upload Parquet files to remote storage.

        :param sample: Whether to upload sample files.
        :param cleanup_local: Whether to delete local files after upload.
        """
        self.storage_client.upload_to_remote(
            sample=sample or self.sample, cleanup_local=cleanup_local
        )

    def import_to_mongo(
        self,
        sample: Optional[bool] = None,
        remote: Optional[bool] = None,
        include: Optional[list[str]] = None,
        exclude: Optional[list[str]] = None,
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
            )

    def download_from_remote(self, sample: Optional[bool] = None):
        """
        Download Parquet files from remote storage.

        :param sample: Whether to download sample files.
        """
        filenames = [
            model.primary_model.parquet_filename for model in self.collection_models
        ]

        self.storage_client.download_from_remote(
            filenames, sample=sample or self.sample
        )


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
