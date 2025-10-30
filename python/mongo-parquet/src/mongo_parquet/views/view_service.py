from typing import final
from mongo_parquet.views.view_tasks import TasksViewService
from pymongo.database import Database
from .view_pages import PagesViewService
from .utils import ViewsUtils


@final
class ViewService:
    def __init__(
        self,
        db: Database,
        parquet_dir_path: str,
        temp_dir_name: str,
    ):
        self.parquet_dir_path: str = parquet_dir_path
        self.utils: ViewsUtils = ViewsUtils(parquet_dir_path, temp_dir_name)
        self.pages_view_service: PagesViewService = PagesViewService(db, self.utils)
        self.tasks_view_service = TasksViewService(db, self.utils)

    def recalculate_pages_view(self):
        self.utils.ensure_temp_dir()
        self.pages_view_service.recalculate_pages_view()

    def recalculate_tasks_view(self):
        self.utils.ensure_temp_dir()
        self.tasks_view_service.recalculate_tasks_view()
