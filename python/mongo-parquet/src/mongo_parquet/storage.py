import os
import datetime
from typing import Literal, Optional, Union
import adlfs
import fsspec
import polars as pl
import s3fs


class RemoteStorageConfig:
    def __init__(
        self,
        storage_type: Union[Literal["azure"], Literal["s3"]],
        remote_container: Optional[str] = None,
    ):
        self.storage_type = storage_type
        self.remote_container = remote_container or os.getenv(
            "DATA_BUCKET_NAME", "data"
        )

        if self.storage_type == "azure":
            self.azure_connection_string = os.getenv("AZURE_DATA_CONNECTION_STRING", "")
            az_fs: adlfs.AzureBlobFileSystem = fsspec.filesystem(
                "abfs",
                connection_string=self.azure_connection_string,
            )
            self.fs = az_fs

        elif self.storage_type == "s3":
            self.aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
            self.aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
            self.region_name = os.getenv("AWS_DEFAULT_REGION", "ca-central-1")

            auth_kwargs = (
                {
                    "key": self.aws_access_key_id,
                    "secret": self.aws_secret_access_key,
                }
                if self.aws_access_key_id and self.aws_secret_access_key
                else {}
            )

            s3_fs: s3fs.S3FileSystem = fsspec.filesystem(
                "s3",
                **auth_kwargs,
                client_kwargs={"region_name": self.region_name},
            )
            self.fs = s3_fs


class StorageClient:
    def __init__(
        self,
        data_dir: str,
        sample_dir: str,
        remote_storage_type: Union[Literal["azure"], Literal["s3"]],
    ):
        self.data_dir = data_dir
        self.sample_dir = sample_dir

        self.remote_storage = RemoteStorageConfig(remote_storage_type)
        self.remote_fs = self.remote_storage.fs
        self.remote_container = self.remote_storage.remote_container

    def target_dirpath(self, sample: bool = False, remote: bool = False) -> str:
        rel_path = self.sample_dir if sample else self.data_dir
        rel_path = os.path.normpath(rel_path)

        if remote:
            return os.path.join(self.remote_container, rel_path)
        else:
            return rel_path

    def target_filepath(
        self, filename: str, sample: bool = False, remote: bool = False
    ) -> str:
        dirpath = self.target_dirpath(sample=sample, remote=remote)
        return os.path.join(dirpath, filename)

    def upload_to_remote(self, sample: bool = False, cleanup_local: bool = True):
        local_dir_path = self.target_dirpath(sample=sample, remote=False)

        print(
            f"☁️ Uploading Parquet files to remote storage `{self.remote_container}/{local_dir_path}`..."
        )

        if not os.path.exists(local_dir_path):
            raise FileNotFoundError(f"Local directory {local_dir_path} does not exist.")

        for root, _, files in os.walk(local_dir_path):
            for file in files:
                if file.endswith(".parquet"):
                    local_path = os.path.join(root, file)

                    remote_filepath = local_path.replace(f"{local_dir_path}/", "")

                    remote_path = self.target_filepath(
                        remote_filepath, sample=sample, remote=True
                    )

                    print(f"⬆️  Uploading: {local_path} → {remote_path}")

                    with open(local_path, "rb") as f:
                        self.remote_fs.pipe_file(remote_path, f.read())

                    if cleanup_local:
                        print(f"🗑️  Deleting local file: {local_path}")
                        os.remove(local_path)

        print("✅ All Parquet files uploaded.")

    def scan_parquet(
        self,
        filename: str,
        sample: bool = False,
        remote: bool = False,
        hive_partitioning: bool = False,
        min_date: Optional[datetime.datetime] = None,
    ) -> pl.LazyFrame:
        print(f"📥 Reading {filename}...")
        local_filepath = self.target_filepath(filename, sample=sample, remote=False)

        if remote:
            self.download_from_remote([filename], sample=sample)

        if not os.path.exists(local_filepath):
            raise FileNotFoundError(f"Local file {local_filepath} does not exist.")

        lf = pl.scan_parquet(local_filepath, hive_partitioning=hive_partitioning)

        if min_date and "date" in lf.columns:
            lf = lf.filter(
                pl.col("date")
                >= pl.date(year=min_date.year, month=min_date.month, day=min_date.day)
            )

        return lf

    def read_parquet(
        self,
        filename: str,
        sample: bool = False,
        remote: bool = False,
        hive_partitioning: bool = False,
        min_date: Optional[datetime.datetime] = None,
    ) -> pl.DataFrame:
        return self.scan_parquet(
            filename,
            sample=sample,
            remote=remote,
            hive_partitioning=hive_partitioning,
            min_date=min_date,
        ).collect()

    def write_parquet(
        self,
        df: pl.DataFrame,
        filename: str,
        sample: bool = False,
        compression_level: int = 7,
    ):
        local_path = self.target_filepath(filename, sample=sample, remote=False)

        print(f"📤 Writing {local_path}...")

        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        df.write_parquet(local_path, compression_level=compression_level)

    def download_from_remote(self, files: list[str], sample: bool = False):
        local_dir_path = self.target_dirpath(sample=sample, remote=False)

        print(
            f"☁️ Downloading Parquet files from remote storage `{self.remote_container}/{local_dir_path}`..."
        )

        for file in files:
            remote_path = self.target_filepath(file, sample=sample, remote=True)

            local_dirpath = self.target_dirpath(sample=sample, remote=False)
            local_filepath = self.target_filepath(file, sample=sample, remote=False)

            if not self.remote_fs.exists(remote_path):
                print(f"❌ Remote file {remote_path} does not exist.")
                continue

            print(f"⬇️  Downloading: {remote_path} to {local_filepath}")

            if self.remote_fs.isdir(remote_path):
                # in this case, the "filepath" is a directory of partitioned Parquet files
                os.makedirs(local_filepath, exist_ok=True)

                dir_glob = os.path.normpath(f"{remote_path}/**/*.parquet")

                dirname = os.path.basename(remote_path)

                self.remote_fs.get(
                    dir_glob,
                    f"{local_dirpath}/{dirname}/",
                    recursive=True,
                )
            else:
                os.makedirs(os.path.dirname(local_filepath), exist_ok=True)
                self.remote_fs.get(remote_path, local_filepath)


__all__ = [
    "RemoteStorageConfig",
    "StorageClient",
]
