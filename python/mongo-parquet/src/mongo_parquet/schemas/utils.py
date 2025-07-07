from datetime import datetime
from bson import ObjectId
from ..sampling import SamplingContext


def get_sample_ids(sampling_context: SamplingContext, id_type: str) -> list:
    """
    Get sample IDs from the sampling context.

    :param sampling_context: The sampling context containing sample IDs.
    :param id_type: The type of IDs to retrieve (e.g., "task", "page", "project").
    :return: A list of sample IDs.
    """
    sample_ids = sampling_context.get(f"{id_type}_ids")

    if not sample_ids:
        raise ValueError(
            f"Tried to get {id_type}_ids from sampling context, but it was not set."
        )
    if not isinstance(sample_ids, list) or len(sample_ids) == 0:
        raise ValueError(f"{id_type}_ids in sampling context must be a non-empty list.")

    if not isinstance(sample_ids[0], ObjectId) and not isinstance(sample_ids[0], str):
        raise ValueError(
            f"{id_type}_ids in sampling context must contain ObjectId instances or strings."
        )

    if isinstance(sample_ids[0], str):
        sample_ids = [ObjectId(sample_id) for sample_id in sample_ids]

    return sample_ids


def get_sample_date_range_filter(sampling_context: SamplingContext) -> dict:
    """
    Get the sample date range from the sampling context.

    :param sampling_context: The sampling context containing the date range.
    :return: A Mongo query filter for the date range.
    """
    date_range = sampling_context.get("date_range")

    if not date_range:
        raise ValueError("date_range in sampling context is not set.")

    if not isinstance(date_range, dict):
        raise ValueError("date_range in sampling context must be a dict.")

    if not date_range.get("start") and not date_range.get("end"):
        raise ValueError(
            "date_range in sampling context must be a dict with 'start' and 'end' keys."
        )

    start_date = date_range.get("start")
    end_date = date_range.get("end")

    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, "%Y-%m-%d")

    if isinstance(end_date, str):
        end_date = datetime.strptime(end_date, "%Y-%m-%d")

    start_filter = (
        {
            "$gte": start_date,
        }
        if start_date
        else {}
    )

    end_filter = (
        {
            "$lte": end_date,
        }
        if end_date
        else {}
    )

    return {"date": {**start_filter, **end_filter}}
