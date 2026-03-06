"""
Deterministic intent guards for plan semantic validation.

Parses the user question for concrete constraints and validates that the
LLM-generated plan honours every one of them.  No external dependencies.

Public API
----------
extract_constraints(question, columns, types, all_rows=None) -> List[Constraint]
check_plan_semantics(constraints, plan)                      -> (bool, List[str])
constraints_to_dicts(constraints)                            -> List[dict]
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, FrozenSet, List, Optional, Tuple


# ─────────────────────────────── Constraint types ────────────────────────────

class AmbiguityError(Exception):
    """Raised when the user intent is inherently ambiguous (needs clarification)."""
    pass

@dataclass
class NumericConstraint:
    """Numeric threshold extracted from question.
    direction="gt"  -> >  (above / over)
    direction="lt"  -> <  (below / under)
    direction="gte" -> >= (at least)
    direction="lte" -> <= (at most)
    """
    column: str
    direction: str   # "gt" | "lt" | "gte" | "lte"
    value: float

    def to_dict(self) -> dict:
        return {"type": "numeric", "column": self.column,
                "direction": self.direction, "value": self.value}

    def __str__(self) -> str:
        ops = {"gt": ">", "lt": "<", "gte": ">=", "lte": "<="}
        op = ops.get(self.direction, self.direction)
        return f"{self.column} {op} {self.value}"


@dataclass
class DateConstraint:
    """Date bound extracted from question.
    direction="before"  → row.date < date_str
    direction="after"   → row.date > date_str
    """
    column: str
    direction: str   # "before" | "after"
    date_str: str    # YYYY-MM-DD

    def to_dict(self) -> dict:
        return {"type": "date", "column": self.column,
                "direction": self.direction, "date": self.date_str}

    def __str__(self) -> str:
        return f"{self.column} {self.direction} {self.date_str}"


@dataclass
class RankingConstraint:
    """Top-N / Bottom-N ranking extracted from question.
    direction="desc"  → top N (sort descending)
    direction="asc"   → bottom N (sort ascending)
    """
    column: str
    n: int
    direction: str   # "desc" | "asc"

    def to_dict(self) -> dict:
        return {"type": "ranking", "column": self.column,
                "n": self.n, "sort_direction": self.direction}

    def __str__(self) -> str:
        label = f"top {self.n}" if self.direction == "desc" else f"bottom {self.n}"
        return f"{label} by {self.column}"


@dataclass
class BooleanConstraint:
    """Exact-match filter on a boolean column."""
    column: str
    value: bool

    def to_dict(self) -> dict:
        return {"type": "boolean", "column": self.column, "value": self.value}

    def __str__(self) -> str:
        return f"{self.column}={'true' if self.value else 'false'}"


@dataclass
class CategoricalConstraint:
    """Exact-match filter on a string/categorical column."""
    column: str
    value: str

    def to_dict(self) -> dict:
        return {"type": "categorical", "column": self.column, "value": self.value}

    def __str__(self) -> str:
        return f"{self.column}={self.value!r}"


@dataclass
class HavingConstraint:
    """HAVING-style filter on the group row-count after group_aggregate.

    Produced by phrases like:
        'more than 5 employees'  → direction='gt', value=5
        'at least 3 workers'     → direction='gte', value=3
        'fewer than 10 people'   → direction='lt', value=10

    Translates to a post-group filter step:
        {"tool": "filter", "args": {"gt": {"count": 5}}}
    """
    direction: str   # "gt" | "lt" | "gte" | "lte"
    value: float

    def to_dict(self) -> dict:
        return {"type": "having", "direction": self.direction, "value": self.value}

    def __str__(self) -> str:
        ops = {"gt": ">", "lt": "<", "gte": ">=", "lte": "<="}
        return f"count {ops.get(self.direction, self.direction)} {self.value}"


# Union alias for type hints
Constraint = Any   # NumericConstraint | DateConstraint | RankingConstraint | ...


# ────────────────────────────── Regex building blocks ────────────────────────

# Direction words that map to exclusive / inclusive bounds
_LT  = r"(?:below|under|lower\s+than|less\s+than|fewer\s+than)"
_LTE = r"(?:at\s+most|no\s+more\s+than|not\s+(?:more|greater)\s+than|maximum\s+of)"
_GT  = r"(?:above|over|higher\s+than|greater\s+than|more\s+than|exceeds?)"
_GTE = r"(?:at\s+least|not\s+less\s+than|minimum\s+of)"

# Signed number (supports negatives like -100)
_NUM = r"(-?\d+(?:\.\d+)?)"

# Words indicating the "top N" subject is a group, not individual rows
_GROUP_SUBJECTS: FrozenSet[str] = frozenset({
    "departments", "locations", "offices", "types",
    "employment_types", "years", "groups", "categories",
    "teams", "regions", "countries", "cities",
})

# Words that signal a group-count HAVING constraint (not a column name)
_EMPLOYEE_WORDS: FrozenSet[str] = frozenset({
    "employees", "workers", "people", "members", "staff", "headcount",
    "persons", "individuals", "records", "entries",
})


# ──────────────────────────── Extraction functions ───────────────────────────

def resolve_remote_col(columns: List[str]) -> Optional[str]:
    for col in columns:
        if col.lower() in ("is_remote", "remote", "remote_work"):
            return col
    for col in columns:
        if "remote" in col.lower():
            return col
    return None


def _numeric_cols(columns: List[str], types: Dict[str, str]) -> List[str]:
    return [c for c in columns if types.get(c) == "numeric"]


def _date_cols(columns: List[str], types: Dict[str, str]) -> List[str]:
    return [c for c in columns if types.get(c) == "date"]


def _bool_cols(columns: List[str], types: Dict[str, str]) -> List[str]:
    return [c for c in columns if types.get(c) == "boolean"]


def _string_cols(columns: List[str], types: Dict[str, str]) -> List[str]:
    return [c for c in columns if types.get(c) == "string"]


# ── Numeric ──

def _having_suppressed_spans(question: str) -> set:
    """Return character spans that belong to employee-count HAVING phrases.

    These spans must be excluded from the numeric-column scan so that a phrase
    like 'more than 5 employees' is never mis-attributed to a dataset column.
    """
    q = question.lower()
    suppressed: set = set()
    emp_pat = r"|".join(re.escape(w) for w in sorted(_EMPLOYEE_WORDS, key=len, reverse=True))
    # Match: <direction> <number> <employee-word>
    full_pat = re.compile(
        rf"(?:{_GT}|{_GTE}|{_LT}|{_LTE})\s+{_NUM}\s+(?:{emp_pat})\b"
    )
    for m in full_pat.finditer(q):
        suppressed.update(range(*m.span()))
    return suppressed


def _extract_numeric(
    question: str,
    columns: List[str],
    types: Dict[str, str],
    suppressed_spans: Optional[set] = None,
) -> List[NumericConstraint]:
    """Extract above/below numeric thresholds for numeric columns.

    Spans listed in *suppressed_spans* are skipped so that employee-count
    HAVING phrases (already handled by _extract_having) are never mis-mapped
    to a dataset column.
    """
    q = question.lower()
    results: List[NumericConstraint] = []
    suppressed_spans = suppressed_spans or set()

    def _span_ok(m: re.Match) -> bool:
        """Return True if the match does not overlap any suppressed span."""
        return not any(i in suppressed_spans for i in range(*m.span()))

    for col in _numeric_cols(columns, types):
        cp = re.escape(col.lower())

        for m in re.finditer(rf"\b{cp}\b\s+{_GT}\s+{_NUM}", q):
            if _span_ok(m): results.append(NumericConstraint(col, "gt", float(m.group(1))))
        for m in re.finditer(rf"\b{cp}\b\s+{_GTE}\s+{_NUM}", q):
            if _span_ok(m): results.append(NumericConstraint(col, "gte", float(m.group(1))))
        for m in re.finditer(rf"\b{cp}\b\s+{_LT}\s+{_NUM}", q):
            if _span_ok(m): results.append(NumericConstraint(col, "lt", float(m.group(1))))
        for m in re.finditer(rf"\b{cp}\b\s+{_LTE}\s+{_NUM}", q):
            if _span_ok(m): results.append(NumericConstraint(col, "lte", float(m.group(1))))

        # Prefix bounds (e.g. "more than 10 projects")
        for m in re.finditer(rf"{_GT}\s+{_NUM}\s+{cp}", q):
            if _span_ok(m): results.append(NumericConstraint(col, "gt", float(m.group(1))))
        for m in re.finditer(rf"{_GTE}\s+{_NUM}\s+{cp}", q):
            if _span_ok(m): results.append(NumericConstraint(col, "gte", float(m.group(1))))
        for m in re.finditer(rf"{_LT}\s+{_NUM}\s+{cp}", q):
            if _span_ok(m): results.append(NumericConstraint(col, "lt", float(m.group(1))))
        for m in re.finditer(rf"{_LTE}\s+{_NUM}\s+{cp}", q):
            if _span_ok(m): results.append(NumericConstraint(col, "lte", float(m.group(1))))

    return results


# ── Having (group-count) ──

def _extract_having(
    question: str,
) -> List[HavingConstraint]:
    """Extract HAVING-style group-count constraints.

    Recognises phrases like:
        'more than 5 employees'
        'at least 3 workers'
        'fewer than 10 people'
    and converts them into HavingConstraint objects instead of NumericConstraints.
    """
    q = question.lower()
    results: List[HavingConstraint] = []
    emp_pat = r"|".join(re.escape(w) for w in sorted(_EMPLOYEE_WORDS, key=len, reverse=True))

    checks = [
        (_GT,  "gt"),
        (_GTE, "gte"),
        (_LT,  "lt"),
        (_LTE, "lte"),
    ]
    for dir_pat, direction in checks:
        pat = re.compile(rf"(?:{dir_pat})\s+{_NUM}\s+(?:{emp_pat})\b")
        for m in pat.finditer(q):
            results.append(HavingConstraint(direction, float(m.group(1))))

    return results


# ── Date ──

_FULL_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}")
_YEAR_ONLY_RE = re.compile(r"\b(\d{4})\b")


def _extract_dates(
    question: str,
    columns: List[str],
    types: Dict[str, str],
) -> List[DateConstraint]:
    """Extract before/after date constraints from question.

    Precision rules
    ---------------
    - Full date  (YYYY-MM-DD): use the exact date as-is.
    - Year only  (YYYY):       apply boundary normalisation:
        after  YYYY  →  YYYY-12-31
        before YYYY  →  YYYY-01-01
    """
    q = question.lower()
    results: List[DateConstraint] = []

    date_cols = _date_cols(columns, types)
    if not date_cols:
        return results

    # Prefer the hire_date column; fall back to the first date column
    primary_col = next((c for c in date_cols if "hire" in c.lower()), date_cols[0])

    # "hired between 2016 and 2020" — handle before any individual before/after
    between = re.search(r"\bbetween\s+(\d{4})\s+and\s+(\d{4})\b", q)
    if between:
        y1, y2 = int(between.group(1)), int(between.group(2))
        results.append(DateConstraint(primary_col, "after",  f"{y1-1}-12-31"))
        results.append(DateConstraint(primary_col, "before", f"{y2+1}-01-01"))
        return results

    # Pattern: optional "hired" prefix, then direction word, then a date token.
    # We check for a full YYYY-MM-DD first; if not found, fall back to bare year.
    _BEFORE_RE_FULL = re.compile(
        r"\b(?:hired\s+)?before\s+(\d{4}-\d{2}-\d{2})\b"
    )
    _AFTER_RE_FULL = re.compile(
        r"\b(?:hired\s+)?after\s+(\d{4}-\d{2}-\d{2})\b"
    )
    _BEFORE_RE_YEAR = re.compile(
        r"\b(?:hired\s+)?before\s+(\d{4})\b"
    )
    _AFTER_RE_YEAR = re.compile(
        r"\b(?:hired\s+)?after\s+(\d{4})\b"
    )

    # Collect spans already consumed by full-date matches so year patterns
    # don't re-match the year portion of a YYYY-MM-DD string.
    consumed: set = set()

    # Full-date matches — use exact date
    for m in _BEFORE_RE_FULL.finditer(q):
        results.append(DateConstraint(primary_col, "before", m.group(1)))
        consumed.update(range(*m.span()))

    for m in _AFTER_RE_FULL.finditer(q):
        results.append(DateConstraint(primary_col, "after", m.group(1)))
        consumed.update(range(*m.span()))

    # Year-only matches — apply boundary normalisation
    for m in _BEFORE_RE_YEAR.finditer(q):
        if not any(i in consumed for i in range(*m.span())):
            results.append(DateConstraint(primary_col, "before", f"{m.group(1)}-01-01"))

    for m in _AFTER_RE_YEAR.finditer(q):
        if not any(i in consumed for i in range(*m.span())):
            results.append(DateConstraint(primary_col, "after", f"{m.group(1)}-12-31"))

    return results


# ── Ranking ──

def _extract_ranking(
    question: str,
    columns: List[str],
    types: Dict[str, str],
) -> List[RankingConstraint]:
    """Extract top-N / bottom-N ranking intent for numeric columns."""
    q = question.lower()
    results: List[RankingConstraint] = []
    num_cols = _numeric_cols(columns, types)

    # Top N
    for m in re.finditer(r"\btop\s+(\d+)\b", q):
        n = int(m.group(1))
        after_top = q[m.end():].strip()

        # Skip if the word right after "top N" is a group plural
        # e.g. "Top 3 departments by total salary" → group_aggregate, not row ranking
        first_word = re.split(r"\s+", after_top)[0] if after_top else ""
        if first_word in _GROUP_SUBJECTS:
            continue

        # Find "by [col]" or "by total [col]" / "by average [col]" in the remainder
        col_match = _find_col_after_by(after_top, num_cols)

        # Fallback: "highest paid" → salary-like column
        if col_match is None and re.search(r"\bhighest\s+paid\b", q):
            col_match = next((c for c in num_cols if "salary" in c.lower()), None)

        if col_match is not None:
            results.append(RankingConstraint(col_match, n, "desc"))

    # Bottom N
    for m in re.finditer(r"\bbottom\s+(\d+)\b", q):
        n = int(m.group(1))
        after_bottom = q[m.end():].strip()
        first_word = re.split(r"\s+", after_bottom)[0] if after_bottom else ""
        if first_word in _GROUP_SUBJECTS:
            continue
        col_match = _find_col_after_by(after_bottom, num_cols)
        if col_match is not None:
            results.append(RankingConstraint(col_match, n, "asc"))

    return results


def _find_col_after_by(text: str, num_cols: List[str]) -> Optional[str]:
    """Find the first numeric column referenced after a 'by' keyword in text."""
    for col in num_cols:
        # Match "by col", "by total col", "by average col", "by avg col"
        pat = rf"\bby\s+(?:total\s+|average\s+|avg\s+)?{re.escape(col.lower())}\b"
        if re.search(pat, text):
            return col
    return None


# ── Boolean ──

def _extract_boolean(
    question: str,
    columns: List[str],
    types: Dict[str, str],
) -> List[BooleanConstraint]:
    """Extract boolean filter intent (remote/non-remote etc.)."""
    q = question.lower()
    results: List[BooleanConstraint] = []

    remote_col = resolve_remote_col(columns)
    if remote_col:
        if re.search(r"\bnon[-\s]?remote\b|\bnot\s+remote\b", q):
            results.append(BooleanConstraint(remote_col, False))
        elif re.search(r"\bremote\b", q):
            results.append(BooleanConstraint(remote_col, True))
        elif re.search(r"\bonsite\b", q):
            results.append(BooleanConstraint(remote_col, False))

    # Global keyword fallback (safety net)
    if not results and "is_remote" in columns:
        if re.search(r"\bremote\b", q):
            results.append(BooleanConstraint("is_remote", True))
        elif re.search(r"\bnon[-\s]?remote\b|\bnot\s+remote\b", q):
            results.append(BooleanConstraint("is_remote", False))
        elif re.search(r"\bonsite\b", q):
            results.append(BooleanConstraint("is_remote", False))

    return results


def _extract_categorical(
    question: str,
    columns: List[str],
    types: Dict[str, str],
    all_rows: Optional[List[dict]],
    excluded_cols: Optional[set] = None,
) -> List[CategoricalConstraint]:
    """
    Extract categorical constraints by matching ANY known value from sample rows
    if it appears in the question (case-insensitive boundary match).
    """
    if not all_rows:
        return []

    excluded_cols = excluded_cols or set()
    str_cols = [c for c in _string_cols(columns, types) if c not in excluded_cols]
    if not str_cols:
        return []

    # Build value → column mapping from a sample of rows
    col_to_uniques: Dict[str, set] = {c: set() for c in str_cols}
    for row in all_rows[:300]:
        for col in str_cols:
            val = str(row.get(col, "")).strip()
            if 2 <= len(val) <= 60:
                col_to_uniques[col].add(val)

    results: List[CategoricalConstraint] = []
    q_lower = question.lower()
    
    # 1. First, look for exact multi-word matches from sample values
    # We sort by length descending to catch "San Francisco" before "San"
    all_sample_values: List[Tuple[str, str]] = []
    for col, unique_vals in col_to_uniques.items():
        for val in unique_vals:
            all_sample_values.append((str(val).lower(), col))
    
    all_sample_values.sort(key=lambda x: len(x[0]), reverse=True)
    
    consumed_indices = set()
    for val_lower, col in all_sample_values:
        if val_lower == "remote":
            if not re.search(r"\b(?:in\s+|location\s+)remote\b", q_lower):
                continue

        pattern = rf"\b{re.escape(val_lower)}\b"
        for m in re.finditer(pattern, q_lower):
            start, end = m.span()
            if not any(i in consumed_indices for i in range(start, end)):
                results.append(CategoricalConstraint(col, val_lower))
                for i in range(start, end): consumed_indices.add(i)

    # 2. Targeted Fallback: if no match, check for high-confidence categorical keywords
    # This solves the "Employees in Sales" (no 'department' word) issue.
    # We only map a few specific department/office names.
    DEPT_WORDS = {"sales", "marketing", "engineering", "human resources", "finance", "legal", "it", "product"}
    # CRITICAL: We EXCLUDE 'remote' from being mapped to office_location categorical filters.
    # We always treat 'remote' as a BOOLEAN intent for 'is_remote'.
    LOC_WORDS = {"london", "san francisco", "tokyo", "berlin", "paris", "sydney"}
    
    for m in re.finditer(r"\b\w+\b", q_lower):
        word = m.group(0)
        start, end = m.span()
        if any(i in consumed_indices for i in range(start, end)):
            continue
        if word in DEPT_WORDS:
            results.append(CategoricalConstraint("department", word))
        elif word in LOC_WORDS:
            results.append(CategoricalConstraint("office_location", word))

    return results


# ─────────────────────────────── Public extractor ────────────────────────────

def extract_constraints(
    question: str,
    columns: List[str],
    types: Dict[str, str],
    all_rows: Optional[List[dict]] = None,
) -> List[Constraint]:
    """
    Deterministically extract all constraints implied by the question.

    Returns a list of constraint objects (NumericConstraint, DateConstraint,
    RankingConstraint, BooleanConstraint, CategoricalConstraint, HavingConstraint).
    Empty list means no constraints were detected.
    """
    booleans = _extract_boolean(question, columns, types)
    bool_cols = {c.column for c in booleans}

    # Compute spans used by employee-count HAVING phrases so the numeric
    # extractor does not mis-attribute them to a dataset column.
    having_spans = _having_suppressed_spans(question)
    having = _extract_having(question)

    return (
        _extract_numeric(question, columns, types, suppressed_spans=having_spans)
        + _extract_dates(question, columns, types)
        + _extract_ranking(question, columns, types)
        + booleans
        + _extract_categorical(question, columns, types, all_rows,
                            excluded_cols=bool_cols)
        + having
    )


def constraints_to_dicts(constraints: List[Constraint]) -> List[dict]:
    """Serialize constraint objects for JSON telemetry."""
    return [c.to_dict() for c in constraints]


# ─────────────────────────── Semantic plan validator ─────────────────────────

def _plan_bool(val: Any) -> Optional[bool]:
    """Parse a plan value as boolean without importing from tools."""
    if val is None:
        return None
    s = str(val).strip().lower()
    if s in ("true", "yes", "1"):
        return True
    if s in ("false", "no", "0"):
        return False
    return None


def check_plan_semantics(
    constraints: List[Constraint],
    plan: Dict[str, Any],
    columns: Optional[List[str]] = None,
) -> Tuple[bool, List[str]]:
    """
    Validate that every extracted constraint is honoured by the plan.

    Returns:
        (is_valid, violation_messages)

    Checks performed per constraint type:
    - NumericConstraint  : correct direction (min vs max) and presence
    - DateConstraint     : correct direction (before vs after) and presence
    - RankingConstraint  : sort step exists + no equals(col=N) misuse + limit
    - BooleanConstraint  : equals filter present with correct value
    - CategoricalConstraint: equals filter present for the column
    - HavingConstraint   : post-group filter on 'count' with correct operator
    """
    if not constraints:
        return True, []

    # ── Collect all filter args from the plan (NORMALIZE KEYS TO LOWERCASE) ──
    f_equals:  Dict[str, Any] = {}
    f_min:     Dict[str, float] = {}
    f_max:     Dict[str, float] = {}
    f_gt:      Dict[str, float] = {}
    f_lt:      Dict[str, float] = {}
    f_before:  Dict[str, str] = {}
    f_after:   Dict[str, str] = {}
    f_contains: Dict[str, str] = {}
    sort_steps: List[Dict] = []
    
    remote_col = resolve_remote_col(columns) if columns else None

    for step in plan.get("steps", []):
        tool = step.get("tool")
        args = step.get("args") or {}
        if tool == "filter":
            for k, v in (args.get("equals") or {}).items():
                kl = k.lower()
                if kl == "remote" and remote_col and remote_col.lower() != "remote":
                    f_equals[remote_col.lower()] = v
                else:
                    f_equals[kl] = v
            for k, v in (args.get("min_value") or {}).items(): f_min[k.lower()] = v
            for k, v in (args.get("max_value") or {}).items(): f_max[k.lower()] = v
            for k, v in (args.get("gt") or {}).items(): f_gt[k.lower()] = v
            for k, v in (args.get("lt") or {}).items(): f_lt[k.lower()] = v
            for k, v in (args.get("before") or {}).items(): f_before[k.lower()] = v
            for k, v in (args.get("after") or {}).items(): f_after[k.lower()] = v
            for k, v in (args.get("contains") or {}).items(): f_contains[k.lower()] = v
        elif tool == "sort":
            norm_sort = {k.lower() if k == "by" else k: v for k, v in args.items()}
            sort_steps.append(norm_sort)

    plan_limit = plan.get("limit", 10)
    has_group_agg = any(
        s.get("tool") == "group_aggregate" for s in plan.get("steps", [])
    )
    # Column being aggregated in group_aggregate (e.g. 'bonus_pct' for avg(bonus_pct)).
    # Post-group filters on 'value' satisfy NumericConstraints on this column.
    group_agg_col: Optional[str] = None
    for _s in plan.get("steps", []):
        if _s.get("tool") == "group_aggregate":
            group_agg_col = (_s.get("args") or {}).get("column", "")
            if group_agg_col:
                group_agg_col = group_agg_col.lower()
            break

    violations: List[str] = []

    group_agg_count = sum(1 for s in plan.get("steps", []) if s.get("tool") == "group_aggregate")
    if group_agg_count > 1:
        violations.append("Plan contains multiple group_aggregate steps. Only one is allowed. Keep the first and remove the others.")

    # ── Check for hallucinated filters (column must exist in dataset schema) ──
    # A filter is only invalid when the column name does not exist in the schema.
    # Do NOT flag filters on valid columns as hallucinations — the LLM may add
    # filters that the regex extractor missed (e.g. implicit constraints).
    if columns:
        schema_cols = {c.lower() for c in columns}
        _virtual_cols = {"value", "count", "group", "_row_index"}
        _check_hallucination = [
            ("equals", f_equals), ("min_value", f_min), ("max_value", f_max),
            ("gt", f_gt), ("lt", f_lt), ("before", f_before), ("after", f_after),
            ("contains", f_contains)
        ]
        for op, f_dict in _check_hallucination:
            for col in f_dict:
                if col not in schema_cols and col not in _virtual_cols:
                    violations.append(f"Hallucinated filter: '{col}' does not exist in the dataset schema.")

    for c in constraints:
        # HavingConstraint has no .column — handle it first and skip column logic.
        if isinstance(c, HavingConstraint):
            # Expect a filter step (post-group) with the right operator on 'count'.
            dir_to_filters = {
                "gt":  f_gt,
                "lt":  f_lt,
                "gte": f_min,
                "lte": f_max,
            }
            count_filters = dir_to_filters.get(c.direction, {})
            val_in_plan = count_filters.get("count")
            if val_in_plan is None:
                # Also accept any operator direction with 'count' as a loose check
                any_count = (
                    f_gt.get("count") or f_lt.get("count")
                    or f_min.get("count") or f_max.get("count")
                )
                if any_count is not None:
                    violations.append(
                        f"Having '{c}': plan filters count with wrong operator "
                        f"(expected '{c.direction}')."
                    )
                else:
                    # Missing 'count' filter.
                    # _inject_constraints_into_plan will add it deterministically --
                    # do NOT flag this as a semantic violation.
                    pass
            else:
                try:
                    if abs(float(val_in_plan) - c.value) > 0.01:
                        violations.append(
                            f"Having '{c}': plan uses count {c.direction} {val_in_plan} "
                            f"instead of {c.value}."
                        )
                except Exception:
                    pass
            continue

        c_col_low = c.column.lower()

        # ── Numeric ──
        if isinstance(c, NumericConstraint):
            target_dict = {"gte": f_min, "lte": f_max, "gt": f_gt, "lt": f_lt}.get(c.direction, {})
            val_in_plan = target_dict.get(c_col_low)

            # In a group_aggregate query, avg/sum/etc of a column is exposed as
            # 'value' in post-group filter steps — not by the original column name.
            # Accept a filter on 'value' when the constraint targets the aggregated col.
            if val_in_plan is None and has_group_agg and group_agg_col == c_col_low:
                val_in_plan = target_dict.get("value")

            if val_in_plan is not None:
                try:
                    if abs(float(val_in_plan) - c.value) > 0.01:
                        violations.append(f"Numeric '{c}': plan uses {val_in_plan} instead of {c.value}.")
                except: pass
            else:
                # Check if they inverted the bound
                anti_dict = {"gte": f_max, "lte": f_min, "gt": f_lt, "lt": f_gt}.get(c.direction, {})
                anti_val = anti_dict.get(c_col_low)
                # Also check 'value' alias for group-agg
                if anti_val is None and has_group_agg and group_agg_col == c_col_low:
                    anti_val = anti_dict.get("value")
                if anti_val is not None:
                    violations.append(f"Numeric '{c}' direction inverted conceptually.")
                elif has_group_agg and group_agg_col == c_col_low:
                    # Missing 'value' filter for the aggregated column.
                    # _inject_constraints_into_plan will add it deterministically —
                    # do NOT flag this as a semantic violation to avoid triggering
                    # a wasteful LLM repair call.
                    pass
                else:
                    violations.append(f"Numeric '{c}' direction '{c.direction}' missing from plan filters.")

        # ── Date ──
        elif isinstance(c, DateConstraint):
            if c.direction == "before":
                val_in_plan = f_before.get(c_col_low)
                if val_in_plan is not None:
                    if str(val_in_plan) != str(c.date_str):
                        violations.append(f"Date '{c}': plan uses {val_in_plan} instead of {c.date_str}.")
                val_in_plan = f_before.get(c_col_low) or f_max.get(c_col_low)
                if val_in_plan is not None:
                    if str(val_in_plan) != str(c.date_str):
                        violations.append(f"Date '{c}': plan uses {val_in_plan} instead of {c.date_str}.")
                elif f_after.get(c_col_low) is not None or f_min.get(c_col_low) is not None:
                    violations.append(f"Date '{c}' direction inverted in plan (uses after).")
                else:
                    violations.append(f"Date '{c}' missing from plan filters.")
            elif c.direction == "after":
                val_in_plan = f_after.get(c_col_low) or f_min.get(c_col_low)
                if val_in_plan is not None:
                    if str(val_in_plan) != str(c.date_str):
                        violations.append(f"Date '{c}': plan uses {val_in_plan} instead of {c.date_str}.")
                elif f_before.get(c_col_low) is not None or f_max.get(c_col_low) is not None:
                    violations.append(f"Date '{c}' direction inverted in plan.")
                else:
                    violations.append(f"Date '{c}' missing from plan filters.")

        # ── Ranking ──
        elif isinstance(c, RankingConstraint):
            if f_equals.get(c_col_low) is not None:
                violations.append(f"Ranking '{c}': plan uses equals({c.column}={f_equals[c_col_low]}) instead of sort+limit.")
            
            if not has_group_agg:
                has_sort = any(s.get("by") == c_col_low for s in sort_steps)
                if not has_sort:
                    violations.append(f"Ranking '{c}': no sort by '{c.column}' in plan.")
                # Direction check
                sort_dir = next((s.get("direction", "desc") for s in sort_steps if s.get("by") in (c_col_low, "value")), None)
                if sort_dir and sort_dir != c.direction:
                    violations.append(f"Ranking '{c}': sort direction is {sort_dir} but should be {c.direction}.")
                
                if plan_limit != c.n:
                    violations.append(f"Ranking '{c}': limit is {plan_limit} instead of {c.n}.")

        # ── Boolean ──
        elif isinstance(c, BooleanConstraint):
            plan_val = f_equals.get(c_col_low)
            if plan_val is None:
                violations.append(f"Boolean '{c}' missing from plan.")
            else:
                if _plan_bool(plan_val) != c.value:
                    violations.append(f"Boolean '{c}': plan has {plan_val} instead of {c.value}.")

        # ── Categorical ──
        elif isinstance(c, CategoricalConstraint):
            plan_val = f_equals.get(c_col_low)
            if plan_val is None:
                violations.append(f"Categorical '{c}' missing from plan.")
            else:
                # Value match is case-insensitive for semantics
                if str(plan_val).lower() != str(c.value).lower():
                    violations.append(f"Categorical '{c}': plan has {plan_val!r} instead of {c.value!r}.")

    is_valid = len(violations) == 0
    return is_valid, violations
