import os
import polars as pl
from pymongoarrow.api import (
    find_polars_all,
    aggregate_polars_all,
)
from pymongo import MongoClient
from pymongoarrow.monkey import patch_all
from typing import Optional
import urllib.parse

from .schemas import MongoCollection, ParquetModel
from .utils import ensure_dataframe

patch_all()


class MongoConfig:
    def __init__(
        self,
        db_name: str,
        host: Optional[str] = None,
        port: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        tls_ca_file: Optional[str] = None,
    ):
        self.db_name = db_name
        self.host = host or os.getenv("DB_HOST", "localhost")
        self.port = port or int(os.getenv("DB_PORT", 27017))
        self.username = (
            username or os.getenv("DOCDB_USERNAME") or os.getenv("MONGO_USERNAME")
        )
        self.password = (
            password or os.getenv("DOCDB_PASSWORD") or os.getenv("MONGO_PASSWORD")
        )
        self.tls_ca_file = (
            tls_ca_file or os.getenv("DB_TLS_CA_FILE") or os.getenv("MONGO_TLS_CA_FILE")
        )
        self.connection_string = self.create_connection_string()
        print(f"Connecting to MongoDB host: {self.host}")

    def create_connection_string(self) -> str:
        """
        Create a MongoDB connection string based on the provided configuration.
        """
        if self.username and self.password:
            tls_ca_file_param = (
                f"&tlsCAFile={urllib.parse.quote(self.tls_ca_file, safe='')}"
                if self.tls_ca_file
                else ""
            )
            query_params = f"?tls=true{tls_ca_file_param}&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false"
            return f"mongodb://{self.username}:{self.password}@{self.host}:{self.port}/{query_params}"

        return f"mongodb://{self.host}:{self.port}/"


class MongoArrowClient:
    def __init__(self, client: MongoClient, db_name: str):
        patch_all()
        self.client = client
        self.db = client[db_name]

    """
  Find all documents in the given collection that match the given query.

  :param model: The model to use for the query.
  :param start: The start date for the query.
  :param end: The end date for the query. (exclusive)
  :param delay_secs: The delay in seconds to wait before executing the query.
  :return: A DataFrame with the results of the query.
  """

    def find(
        self,
        model: ParquetModel,
        filter: Optional[dict] = None,
    ) -> pl.DataFrame:
        # * note: pipelines currently don't support sample filtering
        # * and need filtering to be done in the pipeline
        if model.pipeline:
            results = aggregate_polars_all(
                self.db[model.collection],
                model.pipeline,
                schema=model.schema,
                projection=model.projection,
            )

        elif model.use_aggregation:
            pipeline = []

            if filter or model.filter:
                pipeline.append({"$match": filter or model.filter})

            pipeline.append({"$project": model.projection})

            results = aggregate_polars_all(
                self.db[model.collection],
                pipeline,
                schema=model.schema,
            )

        else:
            results = find_polars_all(
                self.db[model.collection],
                filter or model.filter,  # sample filter needs to be passed explicitly
                schema=model.schema,
                projection=model.projection,
            )

        results = ensure_dataframe(results)

        if model.transform:
            return model.transform(results)

        return results

    def insert_many(
        self,
        model: MongoCollection,
        df: pl.DataFrame,
    ):
        """
        Insert data into the MongoDB collection.

        :param model: The model representing the MongoDB collection.
        :param df: The DataFrame containing the data to insert.
        """
        print(f"Preparing data for insertion into {model.collection} collection...")
        records = model.prepare_for_insert(df)

        print(f"Inserting data into {model.collection} collection...")
        self.db[model.collection].insert_many(records)
        print(f"Inserted {len(records)} records into {model.collection} collection.")


__all__ = [
    "MongoConfig",
    "MongoArrowClient",
]
