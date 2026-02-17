# This script will basically need to be specifically written for any given schema changes,
# but it can be used as a template for future schema migrations.
import os
import polars as pl
from glob import glob
from mongo_parquet.schemas import PageMetrics, ParquetModel, UxTests


def df(
    model: ParquetModel, sample: bool = False, file_path: str | None = None
) -> pl.DataFrame:
    dir_path = "sample" if sample else "data"
    is_dir = os.path.isdir(dir_path)

    if not is_dir:
        raise FileNotFoundError(f"Directory not found: {dir_path}")

    file_path = (
        os.path.join(dir_path, model.parquet_filename)
        if file_path is None
        else os.path.join(dir_path, file_path)
    )

    return pl.read_parquet(file_path)


def migrate_parquet_schemas(sample: bool = False):
    dir_path = "sample" if sample else "data"
    ux_tests = UxTests(dir_path=dir_path)
    page_metrics = PageMetrics(dir_path=dir_path)

    # Migrate UxTests schema
    print(f"Migrating UxTests schema ({'sample' if sample else 'data'})...")
    ux_tests_df = df(ux_tests, sample=sample)

    ux_tests_out_path = os.path.abspath(
        os.path.join(ux_tests.dir_path, ux_tests.parquet_filename)
    )

    print(f"Writing migrated UxTests data to {ux_tests_out_path}...")
    ux_tests_df.with_columns(
        pl.lit(None, dtype=pl.Boolean).alias("wos_cops")
    ).write_parquet(ux_tests_out_path)

    # Migrate PageMetrics schema
    print(f"Migrating PageMetrics schema ({'sample' if sample else 'data'})...")

    page_metrics_files = glob(
        "pages_metrics.parquet/**/*.parquet", root_dir=os.path.abspath(dir_path), recursive=True
    ) if not sample else ["pages_metrics.parquet"]
    
    for file in page_metrics_files:
        file_path = os.path.join(dir_path, file)
        print(f"Processing file: {file_path}")
        page_metrics_df = df(page_metrics, sample=sample, file_path=file)

        page_metrics_out_path = os.path.abspath(
            os.path.join(page_metrics.dir_path, file)
        )

        print(f"Writing migrated PageMetrics data to {page_metrics_out_path}...")
        page_metrics_df.with_columns(
            pl.lit(None, dtype=pl.Int32).alias("visits_referrer_convo_ai")
        ).write_parquet(page_metrics_out_path)


migrate_parquet_schemas(sample=False)
migrate_parquet_schemas(sample=True)
