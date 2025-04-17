import abc
import os
import time
from datetime import datetime
from os import getenv, path, makedirs
import polars as pl
from pymongoarrow.api import Schema, find_polars_all, aggregate_polars_all
from dotenv import load_dotenv
from pymongo import MongoClient
from pymongoarrow.monkey import patch_all
from typing import Optional, overload
from pydantic import BaseModel, ConfigDict, Field
from .utils import ensure_dataframe, month_range, year_range


class MongoModel(abc.ABC):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    collection: str
    schema: Schema
    filter: Optional[dict] = None
    projection: Optional[dict] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None
    pipeline: Optional[list] = None

    @abc.abstractmethod
    def transform(self, df: pl.DataFrame) -> pl.DataFrame:
        pass


class MongoConverter:
    load_dotenv()
    
    def __init__(self, uri=getenv("MONGO_URI")):
        patch_all()
        self.client = MongoClient(f"{uri}?compressors=zstd")
        self.db = "upd-test"

    """
  Find all documents in the given collection that match the given query.

  :param model: The model to use for the query.
  :param start: The start date for the query.
  :param end: The end date for the query. (exclusive)
  :param delay_secs: The delay in seconds to wait before executing the query.
  :return: A DataFrame with the results of the query.
  """

    @overload
    def find(self, model: MongoModel) -> pl.DataFrame: ...

    @overload
    def find(
        self, model: MongoModel, start: datetime, end: datetime
    ) -> pl.DataFrame: ...

    def find(
        self,
        model: MongoModel,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> pl.DataFrame:
        start = start or model.start
        end = end or model.end

        if model.pipeline:
            results = aggregate_polars_all(
                self.client[self.db][model.collection],
                model.pipeline,
                schema=model.schema,
                projection=model.projection,
            )
        else:
            query = (
                {"date": {"$gte": start, "$lte": end}}
                if start and end
                else {}
            )

            if model.filter:
                query.update(model.filter)

            results = find_polars_all(
                self.client[self.db][model.collection],
                query,
                schema=model.schema,
                projection=model.projection,
            )

        results = ensure_dataframe(results)

        if model.transform:
            return model.transform(results)

        return results

    def save(
        self,
        model: MongoModel,
        collection_rename: Optional[str] = None,
        output_dir: Optional[str] = None
    ):
        if collection_rename is not None:
            print(f"Processing {model.collection} as {collection_rename}")
        else:
            print(f"Processing {model.collection}")

        os.makedirs(output_dir or "sample", exist_ok=True)

        df = self.find(model)

        collection_path = (
            collection_rename if collection_rename is not None else model.collection
        )

        filepath = f"{output_dir}/{collection_path}.parquet"

        print(f"Writing {filepath}")

        df.write_parquet(filepath, compression_level=9)

        print("Done")

    def save_months_partitioned(
        self,
        model: MongoModel,
        range_start: str,
        range_end: str,
        collection_rename: Optional[str] = None,
        output_dir="../data",
        delay_secs: int = 5,
    ):
        ranges_iter = month_range(range_start, range_end)

        for start, end in ranges_iter:
            print(
                f"Processing {start.strftime('%Y-%m-%d')} - {end.strftime('%Y-%m-%d')}"
            )
            start_time = datetime.now()
            df = self.find(model, start, end)
            year = start.strftime("%Y")
            month = start.strftime("%m")
            collection_path = (
                collection_rename if collection_rename is not None else model.collection
            )
            dirpath = f"{output_dir}/{collection_path}/year={year}/month={month}"
            filepath = f"{dirpath}/data.parquet"

            if not path.exists(dirpath):
                makedirs(dirpath)

            print(f"Writing to {filepath}")
            df.write_parquet(filepath, compression_level=9)
            print(f"Done in {datetime.now() - start_time}")
            del df
            print(f"waiting {delay_secs} seconds")

            time.sleep(delay_secs)
            print("")

    def save_last_year_present_partitioned(
        self,
        model: MongoModel,
        range_start: str,
        range_end: str,
        collection_rename: Optional[str] = None,
        output_dir="data",
        delay_secs: int = 5,
    ):
        ranges_iter = year_range(range_start, range_end)

        for start, end in ranges_iter:
            print(
                f"Processing {start.strftime('%Y-%m-%d')} - {end.strftime('%Y-%m-%d')}"
            )
            start_time = datetime.now()
            df = self.find(model, start, end).with_columns(
                pl.col("date").dt.year().alias("year")
            )
            year = start.strftime("%Y")
            collection_path = (
                collection_rename if collection_rename is not None else model.collection
            )
            dirpath = f"{output_dir}/{collection_path}/"
            filepath = f"{dirpath}/data.parquet"

            if not path.exists(dirpath):
                makedirs(dirpath)

            print(f"Writing to {filepath}")
            df.write_parquet(filepath, compression_level=9)
            print(f"Done in {datetime.now() - start_time}")
            del df
            print(f"waiting {delay_secs} seconds")

            time.sleep(delay_secs)
            print("")

    def save_years_partitioned(
        self,
        model: MongoModel,
        range_start: str,
        range_end: str,
        collection_rename: Optional[str] = None,
        output_dir="../data",
        delay_secs: int = 5,
    ):
        ranges_iter = year_range(range_start, range_end)

        for start, end in ranges_iter:
            print(
                f"Processing {start.strftime('%Y-%m-%d')} - {end.strftime('%Y-%m-%d')}"
            )
            start_time = datetime.now()
            df = self.find(model, start, end).with_columns(
                pl.col("date").dt.year().alias("year")
            )
            year = start.strftime("%Y")
            collection_path = (
                collection_rename if collection_rename is not None else model.collection
            )
            dirpath = f"{output_dir}/{collection_path}/year={year}"
            filepath = f"{dirpath}/data.parquet"

            if not path.exists(dirpath):
                makedirs(dirpath)

            print(f"Writing to {filepath}")
            df.write_parquet(filepath, compression_level=9)
            print(f"Done in {datetime.now() - start_time}")
            del df
            print(f"waiting {delay_secs} seconds")

            time.sleep(delay_secs)
            print("")
