import polars as pl


def clamp(expr: pl.Expr, scale: float) -> pl.Expr:
    return expr.clip(-scale, scale)

def perf_score_lower_better_0_100(
    value: pl.Expr,
    bench: pl.Expr,
    ceil: pl.Expr,
) -> pl.Expr:
    return (
        pl.when(value.is_null() | bench.is_null() | ceil.is_null())
        .then(None)
        .when(value <= bench)
        .then(
            50.0 + ((bench - value) / bench) * 50.0
        )
        .when(value <= ceil)
        .then(
            ((ceil - value) / (ceil - bench)) * 49.99
        )
        .otherwise(0.0)
        .clip(0.0, 100.0)
    )


def perf_score_higher_better_0_100(
    value: pl.Expr,
    bench: pl.Expr,
    ceil: pl.Expr,
) -> pl.Expr:
    return (
        pl.when(value.is_null() | bench.is_null() | ceil.is_null())
        .then(None)
        .when(value < bench)
        .then(
            (value / bench) * 50.0
        )
        .when(value <= ceil)
        .then(
            50.0 + ((value - bench) / (ceil - bench)) * 50.0
        )
        .otherwise(100.0)
        .clip(0.0, 100.0)
    )

def score_lower_better(value: pl.Expr, bench: pl.Expr, ceil: pl.Expr, *, scale: float) -> pl.Expr:
    inc_better = bench / scale
    inc_worse = (ceil - bench) / scale

    return clamp(
        pl.when(value.is_null() | bench.is_null() | ceil.is_null()).then(None)
        .when(inc_better <= 0)
        .then(pl.when(value <= bench).then(scale).otherwise(None))
        .when(inc_worse <= 0)
        .then(pl.when(value > bench).then(-scale).otherwise(0.0))
        .when(value <= bench)
        .then((bench - value) / inc_better)
        .otherwise(-((value - bench) / inc_worse)),
        scale,
    )


def score_higher_better(value: pl.Expr, bench: pl.Expr, ceil: pl.Expr, *, scale: float) -> pl.Expr:
    inc_better = (ceil - bench) / scale
    inc_worse = bench / scale

    return clamp(
        pl.when(value.is_null() | bench.is_null() | ceil.is_null()).then(None)
        .when(inc_better <= 0)
        .then(pl.when(value >= bench).then(scale).otherwise(None))
        .when(inc_worse <= 0)
        .then(pl.when(value < bench).then(-scale).otherwise(0.0))
        .when(value >= bench)
        .then((value - bench) / inc_better)
        .otherwise(-((bench - value) / inc_worse)),
        scale,
    )


def score_lower_better_ind(value: pl.Expr, bench: pl.Expr, floor: pl.Expr, ceil: pl.Expr, *, scale: float) -> pl.Expr:
    inc_better = (bench - floor) / scale
    inc_worse = (ceil - bench) / scale

    return clamp(
        pl.when(value.is_null() | bench.is_null() | floor.is_null() | ceil.is_null()).then(None)
        .when(value <= floor).then(scale)
        .when(value >= ceil).then(-scale)
        .when(value <= bench).then((bench - value) / inc_better)
        .otherwise(-((value - bench) / inc_worse)),
        scale,
    )

def score_higher_better_ind(value: pl.Expr, bench: pl.Expr, floor: pl.Expr, ceil: pl.Expr, *, scale: float) -> pl.Expr:
    inc_better = (ceil - bench) / scale
    inc_worse = (bench - floor) / scale

    return clamp(
        pl.when(value.is_null() | bench.is_null() | floor.is_null() | ceil.is_null()).then(None)
        .when(value <= floor).then(-scale)
        .when(value >= ceil).then(scale)
        .when(value >= bench).then((value - bench) / inc_better)
        .otherwise(-((bench - value) / inc_worse)),
        scale,
    )

def metric_flags_and_weights(
    *,
    w_calls: float,
    w_feedback: float,
    w_survey: float,
) -> list[pl.Expr]:
    # Count metrics based on underlying volume, not on whether rate is null.
    has_calls_expr = pl.col("calls") > 0
    has_feedback_expr = pl.col("dyfNo") > 0
    has_survey_expr = pl.col("survey") > 0

    metric_count_expr = (
        has_calls_expr.cast(pl.Int32)
        + has_feedback_expr.cast(pl.Int32)
        + has_survey_expr.cast(pl.Int32)
    )

    w_sum_expr = (
        pl.when(has_calls_expr).then(pl.lit(w_calls)).otherwise(0.0)
        + pl.when(has_feedback_expr).then(pl.lit(w_feedback)).otherwise(0.0)
        + pl.when(has_survey_expr).then(pl.lit(w_survey)).otherwise(0.0)
    )

    w_calls_n = (
        pl.when(w_sum_expr > 0)
        .then(
            pl.when(has_calls_expr)
            .then(pl.lit(w_calls) / w_sum_expr)
            .otherwise(0.0)
        )
        .otherwise(0.0)
        .alias("_w_calls")
    )
    w_feedback_n = (
        pl.when(w_sum_expr > 0)
        .then(
            pl.when(has_feedback_expr)
            .then(pl.lit(w_feedback) / w_sum_expr)
            .otherwise(0.0)
        )
        .otherwise(0.0)
        .alias("_w_feedback")
    )
    w_survey_n = (
        pl.when(w_sum_expr > 0)
        .then(
            pl.when(has_survey_expr)
            .then(pl.lit(w_survey) / w_sum_expr)
            .otherwise(0.0)
        )
        .otherwise(0.0)
        .alias("_w_survey")
    )

    return [
        has_calls_expr.alias("_has_calls"),
        has_feedback_expr.alias("_has_feedback"),
        has_survey_expr.alias("_has_survey"),
        metric_count_expr.alias("_metric_count"),
        w_sum_expr.alias("_w_sum"),
        w_calls_n,
        w_feedback_n,
        w_survey_n,
    ]

def weighted_raw_score_over_available(
    calls_score: pl.Expr,
    feedback_score: pl.Expr,
    survey_score: pl.Expr,
    *,
    w_calls: float,
    w_feedback: float,
    w_survey: float,
) -> pl.Expr:
    """
    Excel: rawScore = sum(score_i * w_i) / sum(w_i for non-blank scores)
    """
    has_calls = calls_score.is_not_null()
    has_feedback = feedback_score.is_not_null()
    has_survey = survey_score.is_not_null()

    wsum = (
        pl.when(has_calls).then(pl.lit(w_calls)).otherwise(0.0)
        + pl.when(has_feedback).then(pl.lit(w_feedback)).otherwise(0.0)
        + pl.when(has_survey).then(pl.lit(w_survey)).otherwise(0.0)
    )

    return pl.when(wsum == 0).then(None).otherwise(
        (
            pl.when(has_calls).then(calls_score * pl.lit(w_calls)).otherwise(0.0)
            + pl.when(has_feedback).then(feedback_score * pl.lit(w_feedback)).otherwise(0.0)
            + pl.when(has_survey).then(survey_score * pl.lit(w_survey)).otherwise(0.0)
        )
        / wsum
    )

def score_to_pct(score_raw: pl.Expr, *, scale: float) -> pl.Expr:
    """Map [-scale, +scale] -> [0, 1]. Preserves nulls."""
    return (
        pl.when(score_raw.is_not_null())
        .then((score_raw + pl.lit(scale)) / (pl.lit(2.0) * pl.lit(scale)))
        .otherwise(None)
    )

def ind_status(ind_0_10: pl.Expr) -> pl.Expr:
    return pl.when(ind_0_10.is_null()).then(None).otherwise(
        pl.when(ind_0_10 >= 9.99).then(pl.lit("Best Ever"))
        .when(ind_0_10 <= 0.01).then(pl.lit("Worst Ever"))
        .when(ind_0_10 >= 6.0).then(pl.lit("Improving"))
        .when(ind_0_10 <= 3.0).then(pl.lit("Alert"))
        .when(ind_0_10 <= 4.0).then(pl.lit("At Risk"))
        .otherwise(pl.lit("Stable"))
    )

def ind_scale(ind_0_10: pl.Expr) -> pl.Expr:
    return pl.when(ind_0_10.is_null()).then(None).otherwise((ind_0_10 - 5.0).clip(-5.0, 5.0))