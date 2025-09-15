import os
from copy import deepcopy
from datetime import datetime
from time import sleep
from typing import Optional
import polars as pl
from pymongoarrow.monkey import patch_all
from pymongo import MongoClient
from .mongo import MongoConfig, MongoArrowClient
from .sampling import SamplingContext
from .storage import StorageClient
from .schemas import MongoCollection, ParquetModel
from .utils import get_partition_values, month_range, year_range

# Patch pymongo to support Arrow
patch_all()


class MongoParquetIO:
    """
    A class to handle that wraps the MongoDB client and handles reading and writing local or remote Parquet files.
    """

    def __init__(
        self,
        mongo_config: MongoConfig,
        storage_client: StorageClient,
        sampling_context: SamplingContext,
    ):
        """
        Initialize the MongoParquetIO with a MongoDB collection.

        :param mongo_config: The MongoDB configuration options.
        """
        self.mongo_config = mongo_config
        self.db_name = mongo_config.db_name
        self.connection_string = mongo_config.connection_string

        self.db = MongoArrowClient(
            client=MongoClient(
                self.connection_string, retryWrites=False, compressors=["zstd"]
            ),
            db_name=self.db_name,
        )

        self.storage = storage_client
        self.sampling_context = sampling_context

    def export_to_parquet(
        self,
        collection_model: MongoCollection,
        sample: Optional[bool] = None,
    ):
        """
        Export data from a MongoDB collection to Parquet format.

        :param collection_model: The model representing the MongoDB collection.
        :param sample: Whether to export a sample of the data.
        """
        print(f"📤 Exporting {collection_model.collection} to Parquet...")

        # Ensure the collection exists in the database
        if not self.db.db.list_collection_names():
            raise ValueError(
                f"Collection {collection_model.collection} does not exist in the database."
            )

        for parquet_model in [
            collection_model.primary_model,
            *collection_model.secondary_models,
        ]:
            if not sample and parquet_model.partition_by is not None:
                self.export_partitioned(
                    parquet_model,
                    sample=sample,
                )
                continue

            print(f"Exporting {parquet_model.parquet_filename}...")

            df = self.db.find(
                parquet_model,
                filter=parquet_model.get_sampling_filter(self.sampling_context)
                if sample
                else parquet_model.filter,
            )

            self.storage.write_parquet(
                df,
                parquet_model.parquet_filename,
                sample=sample or False,
            )

    def export_partitioned(
        self,
        parquet_model: ParquetModel,
        sample: Optional[bool] = None,
        filename: str = "0.parquet",  # default file name from polars partitioned write
        delay_secs: int | float = 0.3,
    ):
        """
        Export data from a MongoDB collection to partitioned Parquet format.

        :param parquet_model: The model representing the parquet output.
        :param sample: Whether to export a sample of the data.
        """
        print(f"📤 Exporting {parquet_model.collection} to partitioned Parquet...")

        # Ensure the collection exists in the database
        if not self.db.db.list_collection_names():
            raise ValueError(
                f"Collection {parquet_model.collection} does not exist in the database."
            )

        query_filter = (
            parquet_model.get_sampling_filter(self.sampling_context)
            if sample
            else parquet_model.filter
        ) or {}

        def create_filter(start_date, end_date):
            return {
                **deepcopy(query_filter),
                **{
                    "date": {
                        "$gte": start_date,
                        "$lte": end_date,
                    }
                },
            }

        date_range_start_filter: datetime = query_filter.get("date", {}).get(
            "$gte"
        ) or datetime(2020, 1, 1)

        date_range_end_filter: datetime = (
            query_filter.get("date", {}).get("$lte") or datetime.now()
        )

        if parquet_model.partition_by == "month":
            date_range_iter = month_range(
                date_range_start_filter, date_range_end_filter
            )

        elif parquet_model.partition_by == "year":
            date_range_iter = year_range(date_range_start_filter, date_range_end_filter)

        else:
            raise ValueError(
                f"Unsupported partitioning type: {parquet_model.partition_by}"
            )

        for start, end in date_range_iter:
            print(
                f"Processing {start.strftime('%Y-%m-%d')} - {end.strftime('%Y-%m-%d')}"
            )

            start_time = datetime.now()
            df = self.db.find(parquet_model, create_filter(start, end))

            if df is None or df.is_empty():
                print(f"No data found for {start} - {end}, skipping...")
                continue

            print(f"Found {len(df)} records")

            year = start.strftime("%Y")
            month = start.strftime("%#m" if os.name == "nt" else "%-m")

            self.storage.target_filepath(filename, sample=sample or False, remote=False)

            partition_base_path = (
                parquet_model.parquet_filename
                if parquet_model.parquet_filename
                else f"{parquet_model.collection}.parquet"
            )

            partition_path = f"{partition_base_path}/year={year}"

            if parquet_model.partition_by == "month":
                partition_path += f"/month={month}"

            filepath = f"{partition_path}/{filename}"

            print(f"Writing to {filepath}")

            self.storage.write_parquet(
                df,
                filepath,
                sample=sample or False,
            )

            print(f"Done in {datetime.now() - start_time}")

            del df
            print(f"waiting {delay_secs} seconds")

            sleep(delay_secs)
            print("")

    def import_from_parquet(
        self,
        collection_model: MongoCollection,
        sample: Optional[bool] = None,
        remote: Optional[bool] = None,
        batch_size: int | None = 50_000,
        min_date: Optional[datetime] = None,
    ):
        """
        Insert batches of data into a MongoDB collection.

        :param collection_model: The model representing the MongoDB collection.
        :param sample: Whether to use a sample of the data.
        :param remote: Whether to read data from a remote source.
        :param batch_size: The number of records to insert in each batch.
        """
        start_time = datetime.now()
        formatted_datetime = start_time.strftime("%H:%M:%S")
        print(
            f"📥 [{formatted_datetime}] Importing {collection_model.collection} from Parquet..."
        )
        is_partitioned = collection_model.primary_model.partition_by is not None

        # create collection if it doesn't exist
        if (
            collection_model.primary_model.collection
            not in self.db.db.list_collection_names()
        ):
            self.db.db.create_collection(collection_model.collection)

        def read_df(model: ParquetModel):
            return self.storage.scan_parquet(
                model.parquet_filename,
                sample=sample or False,
                remote=remote or False,
                hive_partitioning=is_partitioned and not sample,
                min_date=min_date,
            )

        primary_df = read_df(collection_model.primary_model)
        secondary_dfs = (
            [read_df(model) for model in collection_model.secondary_models]
            if len(collection_model.secondary_models) != 0
            else []
        )

        if sample or not is_partitioned:
            primary_df = collection_model.primary_model.reverse_transform(primary_df)
            self.insert_batches(
                primary_df,
                [
                    model.reverse_transform(df)
                    for model, df in zip(
                        collection_model.secondary_models, secondary_dfs
                    )
                ],
                collection_model,
                batch_size=batch_size,
            )
            print(f"Import completed in {datetime.now() - start_time}")
            return

        partition_values = (
            get_partition_values(
                primary_df,
                collection_model.primary_model.partition_by,  # type: ignore
            )
            if is_partitioned
            else None
        )

        if partition_values is None or len(partition_values) == 0:
            # If there are no partition values, skip the import
            print(
                f"No data found in {collection_model.primary_model.parquet_filename}, skipping..."
            )
            return

        print(f"Found {len(partition_values)} partitions to process.")

        for partition in partition_values:
            month_str = f"-{partition.get('month', '')}" if "month" in partition else ""
            partition_str = f"{partition['year']}{month_str}"
            start_time = datetime.now()

            print(f"Processing partition: {partition_str}")

            # Filter the DataFrame for the current partition
            partition_filter = [pl.col(col).eq(val) for col, val in partition.items()]

            partition_primary_df = primary_df.filter(*partition_filter)
            partition_primary_df = collection_model.primary_model.reverse_transform(
                partition_primary_df
            )

            if (
                partition_primary_df is None
                or partition_primary_df.collect().is_empty()
            ):
                print(f"df for partition {partition} is None or empty, skipping...")
                continue

            partition_secondary_dfs = [
                df.filter(*partition_filter) for df in secondary_dfs
            ]
            partition_secondary_dfs = [
                model.reverse_transform(df)
                for model, df in zip(
                    collection_model.secondary_models, partition_secondary_dfs
                )
            ]

            self.insert_batches(
                partition_primary_df,
                partition_secondary_dfs,
                collection_model,
                batch_size=batch_size,
            )

            print(
                f"Import for partition {partition_str} completed in {datetime.now() - start_time}"
            )

    def insert_batches(
        self,
        primary_df: pl.LazyFrame,
        secondary_dfs: list[pl.LazyFrame],
        collection_model: MongoCollection,
        batch_size: int | None = 50_000,
    ):
        print(f"Inserting data into {collection_model.collection} collection...")

        # Ensure primary_df is sorted by _id
        primary_df = primary_df.clone().sort("_id")

        len_df = 0

        while True:
            if batch_size is None:
                batch_primary_df = primary_df
            else:
                batch_primary_df = primary_df.slice(len_df, batch_size)

            df = collection_model.assemble(
                batch_primary_df,
                secondary_dfs=secondary_dfs if len(secondary_dfs) > 0 else None,
            )

            batch_df = df.collect(engine="streaming")

            if batch_df is None or (batch_df.is_empty() and len_df == 0):
                print(
                    f"No data found for {collection_model.primary_model.collection}, skipping..."
                )
                return

            if batch_df.is_empty():
                break

            self.db.insert_many(collection_model, batch_df)

            len_df += len(batch_df)

            # free memory
            del batch_df

            if batch_size is None:
                break

        print(f"Inserted {len_df} records into {collection_model.collection}")


__all__ = [
    "MongoParquetIO",
    "MongoCollection",
    "ParquetModel",
    "MongoConfig",
    "SamplingContext",
    "StorageClient",
]
