from logging import error, warning
import os
from copy import deepcopy
from datetime import datetime, timedelta
from time import sleep
from typing import final
import polars as pl
from pymongoarrow.monkey import patch_all
from pymongo import MongoClient
from .mongo import MongoConfig, MongoArrowClient
from .sampling import SamplingContext
from .storage import StorageClient
from .schemas import MongoCollection, ParquetModel
from .utils import (
    format_timedelta,
    get_partition_values,
    month_range,
    year_range,
    SyncUtils,
)

# Patch pymongo to support Arrow
patch_all()


@final
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

    def sync_incremental_parquet(
        self,
        collection_model: MongoCollection,
        sync_utils: SyncUtils,
        sample: bool | None = None,
        partition_filename: str = "0.parquet",  # default file name from polars partitioned write
        cleanup_temp_dir: bool = False,
    ):
        """
        Sync incremental changes from MongoDB to Parquet files.

        :param collection_model: The model representing the MongoDB collection.
        :param sample: Whether to use a sample of the data.
        :param sync_filter: Date filter to apply for incremental sync.
        """
        sync_start_time = datetime.now()
        formatted_datetime = sync_start_time.strftime("%H:%M:%S")
        print(
            f"\n🔄 [{formatted_datetime}] Syncing parquet with incremental changes for {collection_model.collection}..."
        )

        # make sure date is actually in the schema
        if "date" not in collection_model.primary_model.schema:
            raise ValueError(
                f"Collection {collection_model.collection} is set to incremental sync, but has no 'date' field in schema."
            )

        # get latest date
        latest_parquet_date: datetime = (
            collection_model.primary_model.lf()
            .select(pl.col("date").max())
            .collect()["date"]
            .item()
        )

        latest_mongo_date = (
            self.db.db[collection_model.collection].find_one(
                filter=collection_model.primary_model.filter,
                projection={"date": 1},
                sort=[("date", -1)],
            )
            or {}
        ).get("date")

        if latest_mongo_date is None or latest_mongo_date <= latest_parquet_date:
            warning(
                f"No new data found in MongoDB for collection {collection_model.collection}, skipping."
            )
            return

        print(
            f"Latest parquet date: {latest_parquet_date}, latest mongo date: {latest_mongo_date}"
        )

        incremental_filter = {
            "date": {"$gt": latest_parquet_date},
        }

        for parquet_model in [
            collection_model.primary_model,
            *collection_model.secondary_models,
        ]:
            parquet_start_time = datetime.now()
            print(f"Processing {parquet_model.parquet_filename}...")

            sync_utils.ensure_temp_dirs()

            # Do initial processing/hashing for current/previous data
            local_path = self.storage.target_filepath(
                parquet_model.parquet_filename, remote=False
            )

            if os.path.exists(local_path):
                hash_start_time = datetime.now()

                print(f"Hashing {local_path}...")

                sync_utils.add_hash(local_path)

                print(f"Hashed {local_path} in {datetime.now() - hash_start_time}")

            base_filter = (
                parquet_model.get_sampling_filter(self.sampling_context)
                or parquet_model.filter
                or {}
            )
            import re

            re.sub(r"\s+", " ", str(base_filter))

            if base_filter.get("date") is not None:
                base_filter.pop("date")

            combined_filter = {**incremental_filter, **base_filter}

            if parquet_model.partition_by is not None and not sample:

                def create_filter(start_date: datetime, end_date: datetime):
                    return {
                        **deepcopy(combined_filter),
                        **{
                            "date": {
                                "$gte": start_date,
                                "$lte": end_date,
                            }
                        },
                    }

                date_range_start_filter: datetime = latest_parquet_date + timedelta(
                    days=1
                )

                date_range_end_filter: datetime = latest_mongo_date

                if parquet_model.partition_by == "month":
                    date_range_iter = month_range(
                        date_range_start_filter,
                        date_range_end_filter,
                        exact_start_date=True,
                    )

                elif parquet_model.partition_by == "year":
                    date_range_iter = year_range(
                        date_range_start_filter,
                        date_range_end_filter,
                        exact_start_date=True,
                    )

                else:
                    raise ValueError(
                        f"Unsupported partitioning type: {parquet_model.partition_by}"
                    )

                for start, end in date_range_iter:
                    partition_label = (
                        f"{start.strftime('%Y-%m-%d')} - {end.strftime('%Y-%m-%d')}"
                    )
                    print(
                        f"Processing {partition_label} for {parquet_model.collection}..."
                    )

                    partition_start_time = datetime.now()
                    new_data = self.db.find(parquet_model, create_filter(start, end))

                    if new_data is None or new_data.is_empty():  # pyright: ignore[reportUnnecessaryComparison]
                        print(f"No data found for {start} - {end}, skipping...")
                        continue

                    print(f"Found {len(new_data)} new records")

                    year = start.strftime("%Y")
                    month = start.strftime("%#m" if os.name == "nt" else "%-m")

                    partition_base_path = (
                        parquet_model.parquet_filename
                        if parquet_model.parquet_filename
                        else f"{parquet_model.collection}.parquet"
                    )

                    partition_path = f"{partition_base_path}/year={year}"

                    if parquet_model.partition_by == "month":
                        partition_path += f"/month={month}"

                    filepath = f"{partition_path}/{partition_filename}"

                    storage_filepath = self.storage.target_filepath(
                        filepath, sample=sample or False, remote=False
                    )

                    if os.path.exists(storage_filepath):
                        try:
                            print(
                                f"Backing up existing file {filepath} before overwriting..."
                            )
                            sync_utils.backup_file(filepath)

                            print(
                                f"Partition for {partition_path} exists with previous data, writing merged data to {filepath}..."
                            )

                            temp_storage_filepath = re.sub(
                                r"\.parquet$", ".tmp.parquet", storage_filepath
                            )
                            print(
                                f"Writing to temporary file {temp_storage_filepath}..."
                            )

                            pl.concat(
                                [parquet_model.lf(), new_data.lazy()]
                            ).sink_parquet(
                                temp_storage_filepath,
                                compression_level=7,
                                engine="streaming",
                                sync_on_close="all",
                            )

                            os.replace(temp_storage_filepath, storage_filepath)

                            print(f"Successfully wrote to {storage_filepath}")
                        except Exception as e:
                            error(e.add_note(f"Error writing to {storage_filepath}"))
                            sync_utils.restore_backup(filepath)
                    else:
                        print(f"Writing to {filepath}")
                        try:
                            self.storage.write_parquet(
                                new_data,
                                filepath,
                                sample=sample or False,
                            )
                            print(f"Successfully wrote to {storage_filepath}")
                        except Exception as e:
                            error(e.add_note(f"Error writing to {storage_filepath}"))

                    print(
                        f"Updated {filepath} in {format_timedelta(datetime.now() - partition_start_time)}"
                    )

                    sync_utils.queue_upload_if_changed(filepath)

                    del new_data
                    print("")

                    partition_time_elapsed = datetime.now() - partition_start_time

                    print(
                        f"Processed {partition_label} in {format_timedelta(partition_time_elapsed)}"
                    )

                print(
                    f"Finished processing {parquet_model.parquet_filename} in {format_timedelta(datetime.now() - parquet_start_time)}"
                )
                continue

            new_data = self.db.find(
                parquet_model,
                filter=combined_filter,
            )

            if new_data is None or new_data.is_empty():  # pyright: ignore[reportUnnecessaryComparison]
                print("No new or updated records found, skipping...")
                return

            print(f"Found {len(new_data)} new or updated records")

            print(f"Backing up {parquet_model.parquet_filename}...")

            sync_utils.backup_file(parquet_model.parquet_filename)

            target_filepath = self.storage.target_filepath(
                parquet_model.parquet_filename, sample=sample or False, remote=False
            )

            print(f"Appending new data to {target_filepath}...")

            try:
                temp_target_filepath = re.sub(
                    r"\.parquet$", ".tmp.parquet", target_filepath
                )
                print(f"Writing to temporary file {temp_target_filepath}...")

                pl.concat(
                    [parquet_model.lf(), new_data.lazy()], rechunk=True
                ).sink_parquet(
                    temp_target_filepath,
                    compression_level=7,
                    engine="streaming",
                    sync_on_close="all",
                )

                os.replace(temp_target_filepath, target_filepath)

                print(f"Successfully wrote to {target_filepath}")
            except Exception as e:
                error(e.add_note(f"Error writing to {target_filepath}"))
                sync_utils.restore_backup(parquet_model.parquet_filename)

            sync_utils.queue_upload_if_changed(target_filepath)

            print(
                f"Finished processing {parquet_model.parquet_filename} in {format_timedelta(datetime.now() - parquet_start_time)}"
            )

        if cleanup_temp_dir:
            print("Cleaning up temporary directory...")
            sync_utils.cleanup_temp_dir()

        collection_time_elapsed = datetime.now() - sync_start_time
        sync_end_time = datetime.now()
        formatted_end_datetime = sync_end_time.strftime("%H:%M:%S")

        print(
            f"✅ [{formatted_end_datetime}] Completed sync for {collection_model.collection} in {format_timedelta(collection_time_elapsed)}"
        )

    def export_to_parquet(
        self,
        collection_model: MongoCollection,
        sample: bool | None = None,
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
        sample: bool | None = None,
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

        def create_filter(start_date: datetime, end_date: datetime):
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

            if df is None or df.is_empty():  # pyright: ignore[reportUnnecessaryComparison]
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

            print(f"Done in {format_timedelta(datetime.now() - start_time)}")

            del df
            print(f"waiting {delay_secs} seconds")

            sleep(delay_secs)
            print("")

    def import_from_parquet(
        self,
        collection_model: MongoCollection,
        sample: bool | None = None,
        remote: bool | None = None,
        batch_size: int | None = 50_000,
        min_date: datetime | None = None,
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
            print(
                f"Import completed in {format_timedelta(datetime.now() - start_time)}"
            )
            return

        partition_values = (
            get_partition_values(
                primary_df,
                collection_model.primary_model.partition_by,  # type: ignore
            )
            if is_partitioned and collection_model.primary_model.partition_by
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
                partition_primary_df is None  # pyright: ignore[reportUnnecessaryComparison]
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
                f"Import for partition {partition_str} completed in {format_timedelta(datetime.now() - start_time)}"
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

            if batch_df is None or (batch_df.is_empty() and len_df == 0):  # pyright: ignore[reportUnnecessaryComparison]
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
