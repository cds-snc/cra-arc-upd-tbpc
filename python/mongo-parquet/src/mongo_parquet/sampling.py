from typing import Callable, Dict, Any
from copy import deepcopy


class SamplingContext:
    def __init__(self):
        self.sampling_context: Dict[str, Any] = {}

    def update_context(
        self, callable: Callable[[Dict[str, Any]], Dict[str, Any]]
    ) -> None:
        """
        Update the sampling context with data from a callable function.

        :param callable: A function that takes a database client and returns a dictionary.
        """
        self.sampling_context.update(callable(deepcopy(self.sampling_context)))

    def get(self, key: str) -> Any:
        """
        Get a value from the sampling context by key.

        :param key: The key to retrieve from the context.
        :return: The value associated with the key, or None if not found.
        """
        val = self.sampling_context.get(key)

        if val is None:
            raise KeyError(f"Key '{key}' not found in sampling context.")

        return deepcopy(val)

__all__ = ["SamplingContext"]