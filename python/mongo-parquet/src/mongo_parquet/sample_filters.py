from __future__ import annotations

from typing import Any

from bson import ObjectId
import polars as pl


def _normalize_value(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, list):
        return [_normalize_value(item) for item in value]
    return value


def _build_operator_expression(
    column: str,
    operator: str,
    operand: Any,
    dtype: pl.DataType | None,
) -> pl.Expr:
    normalized_operand = _normalize_value(operand)

    if operator == "$in":
        values = normalized_operand if isinstance(normalized_operand, list) else [normalized_operand]
        if isinstance(dtype, pl.List):
            return (
                pl.col(column)
                .list.eval(pl.element().is_in(values))
                .list.any()
            )
        return pl.col(column).is_in(values)

    if operator == "$gte":
        return pl.col(column) >= normalized_operand

    if operator == "$lte":
        return pl.col(column) <= normalized_operand

    if operator == "$exists":
        return pl.col(column).is_not_null() if normalized_operand else pl.col(column).is_null()

    raise ValueError(f"Unsupported filter operator: {operator}")


def _build_filter_expression(
    column: str,
    condition: Any,
    dtype: pl.DataType | None,
) -> pl.Expr | None:
    if isinstance(condition, dict):
        if not condition:
            return None

        expressions: list[pl.Expr] = []
        for operator, operand in condition.items():
            expressions.append(
                _build_operator_expression(column, operator, operand, dtype)
            )

        if not expressions:
            return None

        combined = expressions[0]
        for expr in expressions[1:]:
            combined = combined & expr
        return combined

    normalized_condition = _normalize_value(condition)

    if isinstance(dtype, pl.List):
        return pl.col(column).list.eval(pl.element() == normalized_condition).list.any()

    return pl.col(column) == normalized_condition


def apply_sampling_filter(
    lf: pl.LazyFrame, filter_dict: dict[str, Any] | None
) -> pl.LazyFrame:
    if not filter_dict:
        return lf

    schema = lf.collect_schema()
    expressions: list[pl.Expr] = []

    for column, condition in filter_dict.items():
        if column not in schema:
            continue

        dtype = schema.get(column)
        expression = _build_filter_expression(column, condition, dtype)
        if expression is not None:
            expressions.append(expression)

    if not expressions:
        return lf

    combined = expressions[0]
    for expr in expressions[1:]:
        combined = combined & expr
    return lf.filter(combined)


__all__ = ["apply_sampling_filter"]
