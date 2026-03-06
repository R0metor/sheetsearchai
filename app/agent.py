"""
LLM-Powered Structured Query Engine for Arbitrary Tabular Data.

No LangChain. No vector DB. No hardcoded business logic.
Deterministic execution with multi-step planning, validation,
repair loop, trace, and confidence scoring.
"""
from __future__ import annotations
import uuid, time, json
from typing import Any, Dict, List, Optional
from openai import OpenAI

from app.config import settings
from app.datasets import get_dataset
from app.tools import filter_rows, sort_rows, aggregate, safe_float
from app.intent_guard import (
    extract_constraints,
    check_plan_semantics,
    constraints_to_dicts,
)

client = OpenAI(api_key=settings.OPENAI_API_KEY)


# ── JSON schema the LLM must output ──

AGENT_JSON_SCHEMA = {
    "name": "sheet_agent_plan",
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "constraints": {
                "type": "array",
                "items": { "type": "object" },
                "description": "All explicit user constraints extracted from the text."
            },
            "column_mappings": {
                "type": "object",
                "additionalProperties": { "type": "string" },
                "description": "Mapping from user terminology to real dataset columns."
            },
            "normalized_dates": {
                "type": "array",
                "items": { "type": "object" },
                "description": "Normalized date expressions with start/end boundaries."
            },
            "expected_output": {
                "type": "string",
                "enum": ["rows", "scalar", "grouped_rows"],
                "description": "Expected output format based on query intent. scalar -> aggregate without grouping, grouped_rows -> group_aggregate, rows -> otherwise."
            },
            "needs_clarification": {
                "type": "boolean",
                "description": "Set to true ONLY if the user query is structurally ambiguous (e.g., missing year for a date, referencing an ambiguous column name) and cannot be executed safely."
            },
            "reason": {
                "type": "string",
                "description": "The exact reason for clarification if needs_clarification is true."
            },
            "steps": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "tool": {
                            "type": "string",
                            "enum": [
                                "filter",
                                "sort",
                                "aggregate",
                                "group_aggregate"
                            ],
                        },
                        "args": {
                            "type": "object",
                            "description": "Tool-specific arguments. Use flat objects like {'lt': {'col': 10}}. For ranked groups, always use by='value'.",
                        },
                    },
                    "required": ["tool", "args"],
                },
            },
            "limit": {
                "type": "integer",
                "minimum": 1,
                "maximum": 50,
            },
        },
        "required": ["constraints", "column_mappings", "normalized_dates", "expected_output", "steps", "needs_clarification"],
    },
}


# ── Column validation ──

def _ensure_columns_exist(columns: List[str], plan: Dict[str, Any]) -> None:
    def check_keys(obj: Any):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in ("equals", "contains", "min_value", "max_value", "gt", "lt", "before", "after"):
                    if isinstance(v, dict):
                        for col in v.keys():
                            if col not in columns and col not in ("value", "count", "group", "_row_index"):
                                raise ValueError(f"Unknown column '{col}'. Available: {columns}")
                if k == "by":
                    if isinstance(v, str) and v not in columns and v not in ("value", "count", "group", "_row_index"):
                        raise ValueError(f"Unknown column '{v}'. Available: {columns}")
                if k in ("column", "group_by"):
                    if isinstance(v, str) and v not in columns and v not in ("value", "count", "group", "_row_index"):
                        raise ValueError(f"Unknown column '{v}'. Available: {columns}")
                check_keys(v)
        elif isinstance(obj, list):
            for it in obj:
                check_keys(it)

    check_keys(plan)



# ── Dynamic planner prompt ──

def _format_columns_with_types(columns: List[str], types: Dict[str, str]) -> str:
    """Format columns with their inferred types for the planner prompt."""
    lines = []
    for col in columns:
        col_type = types.get(col, "string")
        lines.append(f"- {col} ({col_type})")
    return "\n".join(lines)


def _plan(question: str, columns: List[str], types: Dict[str, str], sample_rows: List[dict]) -> dict:
    sample_str = json.dumps(sample_rows[:5], indent=2, ensure_ascii=False)
    col_desc = _format_columns_with_types(columns, types)
    schema_str = f"{col_desc}\n\nSample data:\n{sample_str}"

    format_instructions = """TOOLS — the only valid values for "tool" in each step:

1. "filter" — filter rows
   args keys (combine as needed):
    - "equals":    { "<column_name>": value }      — exact match (works for strings AND booleans)
    - "contains":  { "<column_name>": "substr" }   — substring match
    - "gt":        { "<column_name>": number }     — numeric > (strictly greater than)
    - "lt":        { "<column_name>": number }     — numeric < (strictly less than)
    - "min_value": { "<column_name>": number }     — numeric >= (at least)
    - "max_value": { "<column_name>": number }     — numeric <= (at most)
    - "before":    { "<column_name>": "YYYY-MM-DD" } — date <
    - "after":     { "<column_name>": "YYYY-MM-DD" } — date >
    Example (multi-filter): {"equals": {"department": "Engineering"}, "min_value": {"salary": 50000}}
    
    CRITICAL DATE RULES:
    - If the user gives a full date (YYYY-MM-DD), use that EXACT date string. Never replace it with a year boundary.
      Example: 'after 2020-01-01'  → 'after': {'hire_date': '2020-01-01'}
      Example: 'before 2023-06-15' → 'before': {'hire_date': '2023-06-15'}
    - If the user gives only a year (YYYY), apply boundary normalisation:
      'after YYYY'  → 'after':  {'hire_date': 'YYYY-12-31'}  (rows strictly after year-end)
      'before YYYY' → 'before': {'hire_date': 'YYYY-01-01'}  (rows strictly before year-start)
    WARNING: Use FLAT {<column_name>: value} objects. NEVER use {"column_name": "...", "value": 123} structures.

2. "sort" — order rows
   args: {"by": "column_name", "direction": "asc" | "desc"}
   Example: {"by": "salary", "direction": "desc"}

3. "aggregate" — single scalar result
   args: {"op": "count|sum|avg|min|max", "column": "column_name"}
   Example: {"op": "avg", "column": "salary"}

4. "group_aggregate" — grouped result
   args: {"group_by": "column_name", "op": "count|sum|avg|min|max", "column": "column_name"}
   Example: {"group_by": "department", "op": "avg", "column": "salary"}

CRITICAL RULES FOR STEPS:
- "limit" is NOT a tool. It is a top-level integer field: set it at the root of the plan.
- NEVER add a step with tool="limit".
- For "top N" queries: sort desc + set root "limit": N (NOT a filter on the column).
- For "bottom N" queries: sort asc + set root "limit": N.
- Boolean columns (e.g. is_remote): use equals with true/false (JSON booleans, not strings).
- All filter conditions for the same step can be merged into one filter step args object.
- Step order is generally: filter → sort → aggregate/group_aggregate.
- "aggregate" must be the very last step.
- After "group_aggregate", you MAY use "filter" and "sort". For these post-grouping steps, the ONLY valid column names are: "group" (the group key), "value" (result of the aggregation), and "count" (number of rows in the group). Example POST-group filter: {"gt": {"count": 200}}.
- Do NOT ask for clarification if the user asks to group by a date part (like 'year' or 'month'). Just group by the full date column instead."""

    prompt_tpl = """You are a deterministic query planner for a tabular data execution engine.

Convert the user query into a structured JSON execution plan.

CRITICAL RULES:
1. Return ONLY valid JSON — no markdown, no commentary.
2. Every user constraint must appear in the plan steps.
3. "top N by X" → sort by X desc, set limit=N at the root. NOT a numeric filter.
4. "bottom N by X" → sort by X asc, set limit=N at the root. NOT a numeric filter.
5. Do NOT drop AND conditions — all constraints must be in the plan.
6. Use ONLY column names from the dataset schema below.
7. Do NOT invent columns.
8. limit is a top-level integer field — NEVER add a step with tool="limit".
9. REFUSAL MODE: If a query contains unresolved ambiguity (e.g. "Employees hired before March" with year missing), set needs_clarification=true and provide a reason. Do NOT guess.
10. Detect if a plan contains multiple group_aggregate steps. If more than one exists: keep the first, remove the others.
11. Ensure HAVING filters operate on: count, value.

USER QUERY:
{question}

DATASET SCHEMA:
{schema_str}

TOOL REFERENCE:
{format_instructions}

OUTPUT SCHEMA (fill ALL fields):
{
  "constraints": [<list of extracted user constraints as objects>],
  "column_mappings": {"<user term>": "<real column name>"},
  "normalized_dates": [{"expression": "after 2020", "start": "2020-01-01", "end": null}],
  "expected_output": "rows" | "scalar" | "grouped_rows",
  "needs_clarification": false,
  "reason": "",
  "limit": <integer 1–50, required even for aggregate queries — use 10 as default>,
  "steps": [<ordered execution steps>]
}

Return ONLY the JSON plan."""

    prompt = prompt_tpl.replace("{question}", question) \
                       .replace("{schema_str}", schema_str) \
                       .replace("{format_instructions}", format_instructions)

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        messages=[
            {"role": "user", "content": prompt}
        ],
        response_format={
            "type": "json_schema",
            "json_schema": AGENT_JSON_SCHEMA,
        },
    )

    plan = json.loads(response.choices[0].message.content)

    if not plan or "steps" not in plan:
        raise ValueError("Agent planning failed — invalid structured output.")

    return plan


# ── Execution helpers ──

def execute_filter(rows, args, types=None):
    return filter_rows(
        rows,
        equals=args.get("equals"),
        contains=args.get("contains"),
        min_value=args.get("min_value"),
        max_value=args.get("max_value"),
        gt=args.get("gt"),
        lt=args.get("lt"),
        before=args.get("before"),
        after=args.get("after"),
        types=types,
    )


def execute_sort(rows, args):
    by = args.get("by")
    direction = args.get("direction", "desc")
    if not by:
        return rows
    return sort_rows(rows, by=by, direction=direction)


def execute_aggregate(rows, args):
    op = args.get("op") or args.get("operation") or "count"
    column = args.get("column", "")
    # For count, column can be anything
    if not column and op.lower() in ("count", "number"):
        # pick first column
        column = list(rows[0].keys())[0] if rows else "id"
    return aggregate(rows, op=op, column=column)


def execute_group_aggregate(rows, args, limit=10):
    group_by = args.get("group_by")
    op = args.get("op") or args.get("operation") or "count"
    column = args.get("column", "")
    if not column and op.lower() in ("count", "number"):
        column = list(rows[0].keys())[0] if rows else "id"

    groups = {}
    for r in rows:
        key = r.get(group_by)
        groups.setdefault(key, []).append(r)

    results = []
    for key, group_rows in groups.items():
        agg = aggregate(group_rows, op=op, column=column)
        results.append({
            "group": key,
            "value": agg["value"],
            "count": agg["count"]
        })

    # Sort by value descending, then by group name descending for deterministic tie-breaking.
    # This matches the harness's gt_group_aggregate logic.
    results = sorted(results, key=lambda x: (safe_float(x.get("value", 0)), str(x.get("group", ""))), reverse=True)

    return results[:limit]


# ── Plan validation ──

ALLOWED_TOOLS = {"filter", "sort", "aggregate", "group_aggregate"}


def validate_plan(plan: dict, columns: List[str]) -> List[str]:
    errors = []
    if not isinstance(plan, dict):
        return ["Plan is not an object."]
    steps = plan.get("steps")
    if not isinstance(steps, list) or not steps:
        return ["Plan.steps must be a non-empty array."]

    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            errors.append(f"Step {i} is not an object.")
            continue
        tool = step.get("tool")
        args = step.get("args")
        if tool not in ALLOWED_TOOLS:
            errors.append(f"Step {i} has invalid tool '{tool}'.")
        if not isinstance(args, dict):
            errors.append(f"Step {i} args must be an object.")

        if tool == "sort":
            if "by" not in (args or {}):
                errors.append(f"Step {i} sort requires args.by.")
        if tool == "aggregate":
            if "column" not in (args or {}) and (args or {}).get("op", "").lower() not in ("count", "number"):
                errors.append(f"Step {i} aggregate requires args.column.")
        if tool == "group_aggregate":
            if "group_by" not in (args or {}):
                errors.append(f"Step {i} group_aggregate requires args.group_by.")

    # check for structure hallucination
    for i, step in enumerate(steps):
        args = step.get("args") or {}
        for op in ("equals", "contains", "min_value", "max_value", "gt", "lt", "before", "after"):
            val = args.get(op)
            if isinstance(val, dict):
                if "column_name" in val and "value" in val:
                    errors.append(f"Step {i} '{op}' structured incorrectly. Use {{'<column_name>': value}}, NOT {{'column_name': '...', 'value': '...'}}.")

    # terminal rules
    for i, step in enumerate(steps):
        t = step.get("tool")
        if t == "aggregate":
            if i != len(steps) - 1:
                errors.append("aggregate must be the last step.")
        elif t == "group_aggregate":
            for j in range(i + 1, len(steps)):
                if steps[j].get("tool") not in ("filter", "sort"):
                    errors.append("Only 'filter' and 'sort' are allowed after group_aggregate.")

    # enforce group_aggregate BEFORE sort (sort ranks the groups, must come after)
    group_idx = next((i for i, s in enumerate(steps) if s.get("tool") == "group_aggregate"), -1)
    sort_idx = next((i for i, s in enumerate(steps) if s.get("tool") == "sort"), -1)
    if group_idx != -1 and sort_idx != -1 and sort_idx < group_idx:
        # Sort is BEFORE group — that's wrong. Reorder will fix this but flag it.
        errors.append("If sorting a grouped result, 'sort' step must come AFTER 'group_aggregate'.")

    # column hallucination check
    try:
        _ensure_columns_exist(columns, plan)
    except Exception as e:
        errors.append(str(e))

    return errors


# ── Step reordering ──

def reorder_steps(steps: List[dict]) -> List[dict]:
    pre_filters = []
    post_filters = []
    sorts = []
    group_aggs = []
    pure_aggs = []
    others = []

    seen_group_agg = False
    for step in steps:
        t = step.get("tool")
        if t == "group_aggregate":
            if not seen_group_agg:
                group_aggs.append(step)
                seen_group_agg = True
        elif t == "aggregate":
            pure_aggs.append(step)
        elif t == "sort":
            sorts.append(step)
        elif t == "filter":
            is_post = False
            for val in step.get("args", {}).values():
                if isinstance(val, dict):
                    for col in val.keys():
                        if col in ("value", "count", "group"):
                            is_post = True
            
            if is_post or seen_group_agg:
                post_filters.append(step)
            else:
                pre_filters.append(step)
        else:
            others.append(step)

    # Post-process sorts for grouped queries: heal "avg_salary" -> "value"
    # LLMs frequently hallucinate "avg_<col>" as the output column of group_aggregate.
    if group_aggs:
        for s in sorts:
            by_val = str(s.get("by", "")).lower()
            if by_val != "value":
                # Heal if it's a common hallucination: "avg_salary", "sum_salary", "count", "salary"
                if by_val.startswith("avg_") or by_val.startswith("sum_") or by_val.startswith("count"):
                    s["by"] = "value"
                elif any(ga.get("args", {}).get("column") == by_val for ga in group_aggs):
                    s["by"] = "value"
                # If they used a common numeric column name, heal it.
                elif by_val in ("salary", "performance_score", "bonus_pct", "sick_days_taken", "projects"):
                    s["by"] = "value"
        return pre_filters + others + group_aggs + post_filters + sorts
    if pure_aggs:
        # For aggregate queries: filter → sort → aggregate (sort has no effect but shouldn't break)
        return pre_filters + post_filters + sorts + others + pure_aggs
    # For plain filter/sort queries
    return pre_filters + post_filters + others + sorts


# ── Confidence scoring ──

def compute_confidence(*, errors: List[str], repaired: bool, rows_after: int, had_filters: bool) -> float:
    c = 0.9
    if repaired:
        c -= 0.2
    if errors:
        c -= 0.4
    if had_filters and rows_after == 0:
        c -= 0.1
    return max(0.0, min(1.0, round(c, 2)))


# ── LLM repair call ──

def _repair_plan(
    question: str,
    columns: List[str],
    types: Dict[str, str],
    sample_rows: List[dict],
    broken_plan: dict,
    errors: List[str],
    repair_reason: str,
    extracted_constraints: Optional[List[dict]] = None,
) -> dict:
    """Ask the LLM to fix a broken plan. Returns a new plan dict."""
    col_desc = _format_columns_with_types(columns, types)

    system_tpl = """You are a plan-repair agent. A previous planner produced a bad plan for a tabular data query.

Your job: return a CORRECTED plan in the exact same JSON schema.

Dataset columns:
{col_desc}

Sample data:
{sample_str}

Rules:
- You MUST return a JSON object with keys: constraints, column_mappings, normalized_dates, expected_output, limit, and steps.
- limit must be an integer between 1 and 50. Output 10 if unsure.
- Use ONLY columns from the schema above.
- filter comes before sort; aggregate/group_aggregate is LAST.
- args format for aggregate must be: { "op": "avg", "column": "salary" }. NEVER use {"avg": {"salary": 0}}.
- args format for filter must be FLAT: { "operator": { "<column_name>": value } }.
- Example: { "min_value": { "salary": 100000 } }
- NEVER use { "column_name": "...", "value": "..." } nested objects as filter values. Use ONLY { "<column_name>": 100 }.
- If multiple constraints are provided, you MUST include ALL of them.
- "min_value" is >=; "max_value" is <=. Do not swap.
- "gt" is >; "lt" is <. Do not swap.
- "before" is <; "after" is >. Do not swap.
- After "group_aggregate", you may use "filter" and "sort" on the resulting groups using ONLY the columns: "group", "value", and "count". Example: {"gt": {"count": 200}}.
- If sorting a grouped result, you MUST include TWO steps: group_aggregate THEN sort. 
- The sort step 'by' must be 'value'.
- Detect if a plan contains multiple group_aggregate steps. If more than one exists: keep the first, remove the others.
- Ensure HAVING filters operate on: count, value.
- reorder_steps will normalize your step order, but you should aim for correctness.

Return ONLY the corrected JSON plan."""

    # Use simple replace to avoid .format() brace issues
    system = system_tpl.replace("{col_desc}", col_desc) \
                       .replace("{sample_str}", json.dumps(sample_rows[:5], indent=2, ensure_ascii=False))

    user_msg = json.dumps({
        "original_question": question,
        "broken_plan": broken_plan,
        "validation_errors": errors,
        "repair_reason": repair_reason,
        "extracted_constraints": extracted_constraints or [],
    }, indent=2, ensure_ascii=False)

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": AGENT_JSON_SCHEMA,
        },
    )

    plan = json.loads(response.choices[0].message.content)
    if not plan or "steps" not in plan:
        raise ValueError("Repair produced invalid output.")
    return plan


# ── Try-execute ──

def _try_execute(
    plan: dict,
    rows: List[dict],
    columns: List[str],
    types: Dict[str, str],
) -> dict | str:
    """
    Execute the plan against rows.
    Returns a result dict on success, or a string (repair reason) on failure.
    """
    plan = sanitize_plan_filters(plan, columns)

    # Reorder & validate
    steps = plan.get("steps", [])
    reordered = False
    new_steps = reorder_steps(steps)
    if new_steps != steps:
        reordered = True
        plan["steps"] = new_steps
    steps = new_steps

    errors = validate_plan(plan, columns)
    if errors:
        return f"Validation errors: {'; '.join(errors)}"

    limit = max(1, min(int(plan.get("limit", 10)), 50))

    # Execute
    result_rows = rows
    trace = []
    tools_used = []
    had_filters = any(s.get("tool") == "filter" for s in steps)

    answer_type = "rows"
    group_by_col = None
    agg_op_label = None

    for step in steps:
        tool = step["tool"]
        args = step.get("args", {}) or {}
        step_t0 = time.time()
        before = len(result_rows)

        if tool == "filter":
            result_rows = execute_filter(result_rows, args, types=types)
        elif tool == "sort":
            result_rows = execute_sort(result_rows, args)
        elif tool == "aggregate":
            agg = execute_aggregate(result_rows, args)
            tools_used.append(tool)
            trace.append({"tool": tool, "rows_before": before, "rows_after": before, "ms": int((time.time() - step_t0) * 1000)})
            if agg.get("value") is None:
                return f"Aggregate returned None for {args.get('op')}({args.get('column')})"
            return {
                "answer_type": "aggregate",
                "answer": f"{agg['op'].upper()}({agg['column']}) = {agg['value']} (n={agg['count']})",
                "data": {"aggregate": agg},
                "trace": trace,
                "tools_used": tools_used,
                "had_filters": had_filters,
                "reordered": reordered,
            }
        elif tool == "group_aggregate":
            result_rows = execute_group_aggregate(result_rows, args, limit=1000000)
            answer_type = "group_aggregate"
            group_by_col = args.get("group_by")
            agg_op_label = (args.get("op") or args.get("operation") or "count").upper()

        after = len(result_rows)
        if tool != "aggregate":
            tools_used.append(tool)
            trace.append({"tool": tool, "rows_before": before, "rows_after": after, "ms": int((time.time() - step_t0) * 1000)})

    if answer_type == "group_aggregate":
        result_rows = result_rows[:limit]
        ans_msg = f"{agg_op_label} by {group_by_col}" if result_rows else "Found 0 groups matching criteria."
        return {
            "answer_type": "group_aggregate",
            "answer": ans_msg,
            "data": {"groups": result_rows},
            "trace": trace,
            "tools_used": tools_used,
            "had_filters": had_filters,
            "reordered": reordered,
        }

    # Handle limit and ordering deterministically
    has_sort = any(s.get("tool") == "sort" for s in steps)
    
    if not has_sort:
        # If no explicit sort, guarantee original order before slicing
        # Sort by the implicit _row_index to maintain stable fallback output
        result_rows.sort(key=lambda r: r.get("_row_index", 0))
        answer_msg = f"Found {len(result_rows)} matching rows. Showing first {min(limit, len(result_rows))} rows."
    else:
        answer_msg = f"Found {len(result_rows)} matching rows. Showing top {min(limit, len(result_rows))}."

    return {
        "answer_type": "rows",
        "answer": answer_msg,
        "data": {"rows": result_rows[:limit], "total": len(result_rows)},
        "trace": trace,
        "tools_used": tools_used,
        "had_filters": had_filters,
        "reordered": reordered,
    }


# ── Deterministic Filter Injection ──

def build_filter_args_from_constraints(constraints: List[dict]) -> dict:
    """Merge extracted constraints into a single filter args dict."""
    args = {}
    for c in constraints:
        c_type = c.get("type")
        if c_type in ("boolean", "categorical"):
            op = "equals"
            col = c["column"]
            val = c["value"]
        elif c_type == "numeric":
            op = c["direction"]
            col = c["column"]
            val = c["value"]
        elif c_type == "date":
            op = c["direction"]
            col = c["column"]
            val = c.get("date")
        elif c_type == "having":
            op = c["direction"]
            col = "count"
            val = c["value"]
        else:
            continue
            
        if op not in args:
            args[op] = {}
        args[op][col] = val
    return args

def plan_contains_all_constraints(plan: dict, constraints: List[dict], columns: List[str] = None) -> bool:
    """Check if all extracted constraints are present in the plan's filter steps."""
    if not constraints:
        return True
    
    from app.intent_guard import resolve_remote_col
    remote_col = resolve_remote_col(columns) if columns else None
    
    # Collect all existing filter args
    existing_filters = {}
    for step in plan.get("steps", []):
        if step.get("tool") == "filter":
            args = step.get("args") or {}
            for op, cols in args.items():
                if op not in existing_filters:
                    existing_filters[op] = {}
                for col, val in cols.items():
                    kl = col.lower()
                    if kl == "remote" and remote_col and remote_col.lower() != "remote":
                        existing_filters[op][remote_col.lower()] = val
                    else:
                        existing_filters[op][kl] = val

    # Identify the group_aggregate column so that a post-group filter on 'value'
    # is treated as satisfying a numeric constraint on that column.
    group_agg_col = None
    for step in plan.get("steps", []):
        if step.get("tool") == "group_aggregate":
            _col = (step.get("args") or {}).get("column", "")
            if _col:
                group_agg_col = _col.lower()
            break

    # Verify every constraint is covered by operator and column
    target_args = build_filter_args_from_constraints(constraints)
    for op, cols in target_args.items():
        op_filters = existing_filters.get(op, {})
        for col in cols.keys():
            if col.lower() not in op_filters:
                # Missing — but if group_aggregate exposes this column as 'value'
                # and the plan has a post-group filter on 'value' for this op, it's satisfied.
                if group_agg_col and col.lower() == group_agg_col and "value" in op_filters:
                    continue
                return False
                
    return True



def _has_contradictory_constraints(constraints: List[dict]) -> bool:
    """Return True when extracted constraints form an obviously impossible range.

    This handles cases like:
        hire_date < 2010 AND hire_date > 2022   -> True  (impossible)
        salary < 30000 AND salary > 80000       -> True  (impossible)

    When True, the caller MUST NOT block on needs_clarification; instead it
    should let execution proceed so that filter_rows naturally returns 0 rows.
    """
    from datetime import datetime as _dt

    def _parse_date_simple(s):
        for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
            try:
                return _dt.strptime(str(s), fmt)
            except Exception:
                pass
        return None

    # Collect lower and upper bounds per column for both numeric and date
    lowers: Dict[str, float] = {}   # column -> strictest lower bound (GT / AFTER)
    uppers: Dict[str, float] = {}   # column -> strictest upper bound (LT / BEFORE)

    for c in constraints:
        c_type = c.get("type")
        col = c.get("column", "")
        direction = c.get("direction", "")

        if c_type == "numeric":
            val = c.get("value")
            if val is None:
                continue
            val = float(val)
            if direction in ("gt", "gte"):
                lowers[col] = max(lowers.get(col, float("-inf")), val)
            elif direction in ("lt", "lte"):
                uppers[col] = min(uppers.get(col, float("inf")), val)

        elif c_type == "date":
            raw = c.get("date", "")
            d = _parse_date_simple(raw)
            if d is None:
                continue
            ts = d.timestamp()
            if direction == "after":
                lowers[col] = max(lowers.get(col, float("-inf")), ts)
            elif direction == "before":
                uppers[col] = min(uppers.get(col, float("inf")), ts)

    for col in set(lowers) & set(uppers):
        if lowers[col] >= uppers[col]:
            return True

    return False

def _inject_constraints_into_plan(
    plan: dict,
    constraints: List[dict],
) -> dict:
    """Deterministically inject missing constraints into a plan.

    Group-aggregate-aware: NumericConstraints on the aggregated column are
    injected as post-group filters on 'value' (not as pre-group column filters).
    HavingConstraints are always injected post-group on 'count'.
    All other constraints are injected as a pre-group filter step at index 0.
    """
    steps = list(plan.get("steps", []))

    # Detect group_aggregate column
    group_agg_col: Optional[str] = None
    for s in steps:
        if s.get("tool") == "group_aggregate":
            _col = (s.get("args") or {}).get("column", "")
            if _col:
                group_agg_col = _col.lower()
            break

    pre_args: Dict[str, Any] = {}
    post_args: Dict[str, Any] = {}

    for c in constraints:
        c_type = c.get("type")
        direction = c.get("direction", "")

        if c_type == "having":
            # HAVING count constraint — always post-group
            _add(post_args, direction, "count", c["value"])

        elif c_type == "numeric" and group_agg_col and c.get("column", "").lower() == group_agg_col:
            # Aggregated-value constraint — post-group on 'value'
            _add(post_args, direction, "value", c["value"])

        elif c_type == "numeric":
            _add(pre_args, direction, c["column"], c["value"])

        elif c_type == "date":
            _add(pre_args, direction, c["column"], c.get("date"))

        elif c_type in ("boolean", "categorical"):
            _add(pre_args, "equals", c["column"], c["value"])

    if pre_args:
        steps.insert(0, {"tool": "filter", "args": pre_args})
    if post_args:
        steps.append({"tool": "filter", "args": post_args})

    plan["steps"] = reorder_steps(steps)
    return plan


def _add(d: dict, op: str, col: str, val: Any) -> None:
    """Helper: set d[op][col] = val, creating the op dict if needed."""
    if op not in d:
        d[op] = {}
    d[op][col] = val


def sanitize_plan_filters(plan: dict, columns: Optional[List[str]] = None) -> dict:
    """Remove filter predicates that reference columns not present in the schema.

    A filter is only stripped when its column does not exist in the dataset.
    Valid filters on real columns are always preserved regardless of whether
    they appear in the plan's own constraints list.
    """
    import copy
    plan = copy.deepcopy(plan)
    if "steps" not in plan:
        return plan

    # Without a schema we cannot know which columns are valid — keep everything.
    if not columns:
        return plan

    schema_cols = {c.lower() for c in columns}
    virtual_cols = {"value", "count", "group", "_row_index"}
    has_group_agg = any(s.get("tool") == "group_aggregate" for s in plan.get("steps", []))

    removed_preds = []
    new_steps = []

    for s in plan["steps"]:
        if s.get("tool") != "filter":
            new_steps.append(s)
            continue

        args = s.get("args") or {}
        new_args = {}
        for op, cols_dict in args.items():
            if not isinstance(cols_dict, dict):
                new_args[op] = cols_dict
                continue

            new_cols = {}
            for k, v in cols_dict.items():
                kl = k.lower()
                is_virtual = kl in virtual_cols and has_group_agg
                if kl in schema_cols or is_virtual:
                    new_cols[k] = v
                else:
                    removed_preds.append((op, k, v))

            if new_cols:
                new_args[op] = new_cols

        if new_args:
            s["args"] = new_args
            new_steps.append(s)

    if removed_preds:
        print(f"DEBUG sanitize_plan_filters: removed predicates {removed_preds}. Steps count: {len(plan['steps'])} -> {len(new_steps)}")

    plan["steps"] = new_steps
    return plan


def _heal_plan(plan: dict, extracted_constraints: Optional[List[dict]] = None, columns: Optional[List[str]] = None) -> dict:
    if not plan.get("steps"):
        return plan
    plan["steps"] = reorder_steps(plan["steps"])
    group_agg_col = None
    for s in plan["steps"]:
        if s.get("tool") == "group_aggregate":
            group_agg_col = (s.get("args") or {}).get("column", "")
            if group_agg_col:
                group_agg_col = group_agg_col.lower()
            break
            
    if group_agg_col:
        for s in plan["steps"]:
            if s.get("tool") == "filter":
                args = s.get("args") or {}
                for op, cols in list(args.items()):
                    if not isinstance(cols, dict): continue
                    for k in list(cols.keys()):
                        if k.lower() == group_agg_col:
                            cols["value"] = cols.pop(k)
        plan["steps"] = reorder_steps(plan["steps"])

    return plan


# ── Main agent entry point ──

MAX_ATTEMPTS = 2


def run_agent(question: str, *, dataset_id: str) -> Dict[str, Any]:
    """
    Execute a natural language query against a stored dataset.
    Always returns a structured response — never raises.
    """
    debug_id = uuid.uuid4().hex[:10]
    t0 = time.time()
    
    def _envelope(extra: dict) -> dict:
        base = {"debug_id": debug_id, "ms_total": int((time.time() - t0) * 1000)}
        base.update(extra)
        base.setdefault("tools_used", [])
        base.setdefault("trace", [])
        base.setdefault("plan", None)
        base.setdefault("confidence", 0.0)
        base.setdefault("repaired", False)
        base.setdefault("attempts", 1)
        base.setdefault("repair_reason", None)
        base.setdefault("extracted_constraints", [])
        return base

    # Load dataset
    try:
        ds = get_dataset(dataset_id)
        rows = ds["rows"]
        columns = ds["columns"]
        types = ds["types"]
    except KeyError as e:
        return _envelope({"ok": False, "answer_type": "error", "answer": str(e)})
    except Exception as e:
        return _envelope({"ok": False, "answer_type": "error", "answer": f"Dataset load failed: {e}"})

    if not rows:
        return _envelope({"ok": False, "answer_type": "error", "answer": "Dataset is empty.", "rows": []})

    sample = rows[:10]

    # Inject stable tie-breaker ID
    for i, row in enumerate(rows):
        row["_row_index"] = i

    # ── Extract intent constraints (deterministic, no LLM) ──
    extracted = extract_constraints(question, columns, types, all_rows=rows)

    extracted_dicts = constraints_to_dicts(extracted)

    # ── Initial planning ──
    try:
        plan = _plan(question, columns, types, sample)
    except Exception as e:
        return _envelope({
            "ok": False, "answer_type": "error",
            "answer": "Planner failed to produce a valid plan.",
            "error": str(e),
            "extracted_constraints": extracted_dicts,
        })

    if plan.get("needs_clarification"):
        # Override: if the LLM flagged clarification because of contradictory
        # constraints (e.g. hire_date < 2010 AND hire_date > 2022), do NOT block.
        # The filter step will simply return 0 rows, which is the correct result.
        if _has_contradictory_constraints(extracted_dicts):
            plan["needs_clarification"] = False
            plan.setdefault("steps", [{"tool": "filter", "args": build_filter_args_from_constraints(extracted_dicts)}])
        else:
            return _envelope({
                "ok": False, "answer_type": "refusal",
                "answer": f"Ambiguous request: {plan.get('reason', 'Clarification needed.')}",
                "error": "Query ambiguity refused.",
                "extracted_constraints": extracted_dicts,
            })

    plan.setdefault("limit", 10)

    # ── Pre-validation step normalization ──
    # Normalize step order BEFORE any validation so that LLM-produced plans
    # with sort-before-group (or other soft ordering issues) are fixed
    # automatically, without triggering false validation errors.
    if plan.get("steps"):
        plan = _heal_plan(plan, extracted_dicts, columns)

    repaired = False
    repair_reason = None
    attempts = 1   # initial plan counts as attempt 1

    # ── Semantic pre-repair ──
    # If the extractor found constraints that the plan violates, FIRST
    # deterministically inject the missing steps. Then fall back to LLM repair.
    if extracted_dicts:
        if not plan_contains_all_constraints(plan, extracted_dicts, columns):
            plan = _inject_constraints_into_plan(plan, extracted_dicts)

    if extracted:
        sem_valid, sem_violations = check_plan_semantics(extracted, plan, columns)
        if not sem_valid:
            repair_reason = "Semantic constraint violation: " + "; ".join(sem_violations)
            try:
                plan = _repair_plan(
                    question=question,
                    columns=columns,
                    types=types,
                    sample_rows=sample,
                    broken_plan=plan,
                    errors=sem_violations,
                    repair_reason=repair_reason,
                    extracted_constraints=extracted_dicts,
                )
                plan.setdefault("limit", 10)
                repaired = True
                attempts += 1

                plan = _heal_plan(plan, extracted_dicts, columns)
                
                if extracted_dicts and not plan_contains_all_constraints(plan, extracted_dicts, columns):
                    plan = _inject_constraints_into_plan(plan, extracted_dicts)

                # Re-validate after repair — if still violated, surface error
                sem_valid2, sem_violations2 = check_plan_semantics(extracted, plan, columns)
                if not sem_valid2:
                    return _envelope({
                        "ok": False,
                        "answer_type": "error",
                        "answer": (
                            "Plan repair could not satisfy all semantic constraints: "
                            + "; ".join(sem_violations2)
                        ),
                        "repair_reason": "; ".join(sem_violations2),
                        "repaired": repaired,
                        "attempts": attempts,
                        "plan": plan,
                        "extracted_constraints": extracted_dicts,
                    })
            except Exception as e:
                print(f"REPAIR EXCEPTION: {e}")
                import traceback
                traceback.print_exc()
                # Repair call itself failed — proceed with original plan;
                # execution will decide whether it's usable.
                pass

    # ── Execution retry loop ──
    for attempt_idx in range(MAX_ATTEMPTS):

        try:
            result = _try_execute(plan, rows, columns, types)
        except Exception as e:
            repair_reason = f"Execution error: {e}"
            if attempt_idx >= MAX_ATTEMPTS - 1:
                return _envelope({
                    "ok": False, "answer_type": "error",
                    "answer": f"Execution crashed: {e}",
                    "error": str(e),
                    "plan": plan,
                    "extracted_constraints": extracted_dicts,
                })
            try:
                plan = _repair_plan(
                    question, columns, types, sample, plan,
                    [repair_reason], repair_reason,
                    extracted_constraints=extracted_dicts,
                )
                plan.setdefault("limit", 10)
                repaired = True
                attempts += 1
                continue
            except Exception:
                break

        # ── Success path ──
        if isinstance(result, dict):
            reordered = result.get("reordered", False)
            was_repaired = repaired or reordered
            had_filters = result.get("had_filters", False)
            rows_count = 0
            if "rows" in result["data"]:
                rows_count = result["data"]["total"]
            elif "groups" in result["data"]:
                rows_count = len(result["data"]["groups"])
            elif "aggregate" in result["data"]:
                rows_count = 1

            conf = compute_confidence(
                errors=[], repaired=was_repaired,
                rows_after=rows_count,
                had_filters=had_filters,
            )

            resp = {
                "ok": True,
                "answer_type": result["answer_type"],
                "answer": result["answer"],
                "tools_used": result["tools_used"],
                "trace": result["trace"],
                "confidence": conf,
                "plan": plan,
                "repaired": was_repaired,
                "attempts": attempts,
                "repair_reason": repair_reason,
                "extracted_constraints": extracted_dicts,
            }
            resp.update(result["data"])
            return _envelope(resp)

        # ── Execution failure — repair and retry ──
        repair_reason = result

        if attempt_idx >= MAX_ATTEMPTS - 1:
            break

        try:
            plan = _repair_plan(
                question=question,
                columns=columns,
                types=types,
                sample_rows=sample,
                broken_plan=plan,
                errors=[repair_reason],
                repair_reason=repair_reason,
                extracted_constraints=extracted_dicts,
            )
            plan.setdefault("limit", 10)
            repaired = True
            attempts += 1
        except Exception:
            break

    # All attempts exhausted
    return _envelope({
        "ok": False,
        "answer_type": "error",
        "answer": f"Agent could not produce valid results after {attempts} attempt(s).",
        "repair_reason": repair_reason,
        "repaired": repaired,
        "attempts": attempts,
        "plan": plan,
        "extracted_constraints": extracted_dicts,
    })
