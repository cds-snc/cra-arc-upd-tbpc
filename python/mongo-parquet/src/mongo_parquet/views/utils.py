import os
import polars as pl
import re
from datetime import timedelta


class ViewsUtils:
    def __init__(self, parquet_dir_path: str, temp_dir_name: str = ".views_temp"):
        temp_dir_str = os.path.join(parquet_dir_path, "..", temp_dir_name)
        self.parquet_dir_path: str = os.path.abspath(parquet_dir_path)
        self.temp_dir_path: str = os.path.abspath(temp_dir_str)

    def ensure_temp_dir(self):
        if not os.path.exists(self.temp_dir_path):
            os.makedirs(self.temp_dir_path, exist_ok=True)

    def cleanup_temp_dir(self):
        if os.path.exists(self.temp_dir_path):
            try:
                for root, dirs, files in os.walk(self.temp_dir_path, topdown=False):
                    for name in files:
                        os.remove(os.path.join(root, name))
                    for name in dirs:
                        os.rmdir(os.path.join(root, name))
            except Exception as e:
                print(
                    f"Failed to delete temp views directory {self.temp_dir_path}. Reason: {e}"
                )

    def scan_temp(self, file_name: str) -> pl.LazyFrame:
        temp_file_path = os.path.join(self.temp_dir_path, file_name)
        return pl.scan_parquet(temp_file_path)

    def sink_temp(self, lf: pl.LazyFrame, file_name: str):
        self.ensure_temp_dir()
        temp_file_path = os.path.join(self.temp_dir_path, file_name)
        lf.sink_parquet(temp_file_path, compression_level=5)


def format_timedelta(td: timedelta) -> str:
    if td.total_seconds() < 1:
        return str(td)
    ms_regex = re.compile(r"\.\d{6}$")

    return re.sub(ms_regex, "", str(td))
