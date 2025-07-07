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
from .utils import month_range, year_range

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
    ):
        """
        Import data from Parquet files into a MongoDB collection.

        :param collection_model: The model representing the MongoDB collection.
        :param sample: Whether to import a sample of the data.
        :param remote: Whether to import data from a remote source.
        """

        start_time = datetime.now()

        if (
            sample is not True
            and collection_model.primary_model.partition_by is not None
        ):
            self.import_from_parquet_partitioned(
                collection_model,
                sample=sample,
                remote=remote,
            )
            print(f"Import completed in {datetime.now() - start_time}")
            return

        print(f"📥 Importing {collection_model.collection} from Parquet...")

        def prepare_df(model: ParquetModel) -> pl.DataFrame | None:
            df = self.storage.read_parquet(
                model.parquet_filename, sample=sample or False, remote=remote or False
            )

            if df is None or df.is_empty():
                print(f"No data found in {model.parquet_filename}, skipping...")
                return

            print(f"Found {len(df)} records in {model.parquet_filename}")

            return model.reverse_transform(df)

        primary_df = prepare_df(collection_model.primary_model)

        if primary_df is None:
            print(
                f"No data found for primary model {collection_model.primary_model.parquet_filename}, skipping..."
            )
            return

        # create collection if it doesn't exist
        if (
            collection_model.primary_model.collection
            not in self.db.db.list_collection_names()
        ):
            self.db.db.create_collection(collection_model.collection)

        if (
            collection_model.secondary_models is None
            or len(collection_model.secondary_models) == 0
        ):
            df = primary_df
        else:
            # If there are secondary models, prepare them
            print(f"Preparing secondary models for {collection_model.collection}...")

            secondary_dfs = [
                prepare_df(model) for model in collection_model.secondary_models
            ]

            secondary_dfs = [df for df in secondary_dfs if df is not None]

            df = collection_model.assemble(primary_df, secondary_dfs=secondary_dfs)

        len_df = len(df)
        self.db.insert_many(collection_model, df)

        print(f"Inserted {len_df} records into {collection_model.collection}")
        print(f"Import completed in {datetime.now() - start_time}")

    def import_from_parquet_partitioned(
        self,
        collection_model: MongoCollection,
        sample: Optional[bool] = None,
        remote: Optional[bool] = None,
    ):
        """
        Import data from partitioned Parquet files into a MongoDB collection.

        :param collection_model: The model representing the MongoDB collection.
        :param sample: Whether to import a sample of the data.
        :param remote: Whether to import data from a remote source.
        """
        print(f"📥 Importing {collection_model.collection} from partitioned Parquet...")

        def read_partitioned(filename: str):
            return self.storage.read_parquet_partitioned(
                filename,
                sample=sample or False,
                remote=remote or False,
            )

        primary_lf = read_partitioned(collection_model.primary_model.parquet_filename)
        secondary_lfs = (
            [
                (model, read_partitioned(model.parquet_filename))
                for model in collection_model.secondary_models
            ]
            if len(collection_model.secondary_models) != 0
            else []
        )

        if collection_model.primary_model.partition_by is None:
            raise ValueError(
                "Tried to import partitioned data without a partition_by field. "
            )

        partition_cols = (
            ["year", "month"]
            if collection_model.primary_model.partition_by == "month"
            else ["year"]
        )

        if not all(
            col in primary_lf.collect_schema().names() for col in partition_cols
        ):
            raise ValueError(
                f"Partition columns {partition_cols} not found in the DataFrame."
            )

        partition_values = (
            primary_lf.select(partition_cols)
            .unique(partition_cols)
            .sort(partition_cols)
            .collect()
            .to_dicts()
        )

        if len(partition_values) == 0:
            # If there are no partition values, skip the import
            print(
                f"No data found in {collection_model.primary_model.parquet_filename}, skipping..."
            )
            return

        print(f"Found {len(partition_values)} partitions to process.")

        def prepare_df(
            model: ParquetModel, lf: pl.LazyFrame, filter: list[pl.Expr]
        ) -> pl.DataFrame | None:
            df = lf.filter(*filter).collect()

            if df is None or df.is_empty():
                print(f"No data found in {model.parquet_filename}, skipping...")
                return

            print(f"Found {len(df)} records in {model.parquet_filename} for partition")

            return model.reverse_transform(df)

        for partition in partition_values:
            month_str = f"-{partition.get('month', '')}" if "month" in partition else ""
            partition_str = f"{partition['year']}{month_str}"
            start_time = datetime.now()

            print(f"Processing partition: {partition_str}")

            # Filter the DataFrame for the current partition
            partition_filter = [pl.col(col).eq(val) for col, val in partition.items()]

            primary_df = prepare_df(
                collection_model.primary_model, primary_lf, partition_filter
            )

            if primary_df is None or primary_df.is_empty():
                print(f"No data found for partition {partition}, skipping...")
                continue

            print(f"Found {len(primary_df)} records in partition {partition_str}")

            # create collection if it doesn't exist
            if (
                collection_model.primary_model.collection
                not in self.db.db.list_collection_names()
            ):
                self.db.db.create_collection(collection_model.collection)

            if len(secondary_lfs) == 0:
                df = primary_df

            secondary_dfs = [
                prepare_df(model, lf, partition_filter) for model, lf in secondary_lfs
            ]

            secondary_dfs = [df for df in secondary_dfs if df is not None]

            df = collection_model.assemble(primary_df, secondary_dfs=secondary_dfs)

            self.db.insert_many(collection_model, df)

            print(
                f"Inserted {len(primary_df)} records into {collection_model.collection}"
            )
            print(
                f"Import for partition {partition_str} completed in {datetime.now() - start_time}"
            )


__all__ = [
    "MongoParquetIO",
    "MongoCollection",
    "ParquetModel",
    "MongoConfig",
    "SamplingContext",
    "StorageClient",
]
