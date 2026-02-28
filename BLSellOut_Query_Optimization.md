# BLSellOut Query – Bottleneck Analysis & Optimizations

## 1. Bottleneck summary

| Area | Issue | Impact |
|------|--------|--------|
| **#Groups** | No index; `DISTINCT` over many columns | High – probed many times by main query |
| **#newcust** | No index; built from full `AR_NewCustomerInfor` | Medium – large temp table, joined twice per row |
| **Main query** | Two almost identical branches in `UNION` | High – base tables scanned twice |
| **Date/time** | `FORMAT()` and repeated `SYSDATETIMEOFFSET()` | Medium – CPU and repeated work |
| **Scalar UDF** | `dbo.fr_GetLang(@LangID, ...)` in SELECT | High if called per row – forces row-by-row execution |
| **Lookups** | Many `LEFT JOIN`s to small tables | Low–medium – ensure indexes on join keys |

---

## 2. Root causes and fixes

### 2.1 Temp table `#Groups`

- **Issue**: Built with `SELECT DISTINCT` and no index. The main query joins to `#Groups` with `(BranchID, OrderNbr, InvtID, LineRef)` in both UNION branches, so the table is probed very often.
- **Fix**: Add a clustered (or covering) index on the join columns immediately after `INSERT`:

```sql
CREATE CLUSTERED INDEX IX_Groups ON #Groups(BranchID, OrderNbr, InvtID, LineRef);
```

- **Optional**: If the same `(BranchID, OrderNbr, InvtID, LineRef)` can only appear once in the source, consider building `#Groups` with a query that guarantees uniqueness (e.g. `GROUP BY` or `EXISTS`) instead of `DISTINCT`, so the engine can use a single row per combination.

### 2.2a UNION vs UNION ALL

- **Issue**: The original uses `UNION`, which removes duplicates and adds a sort/distinct cost.
- **Fix**: If the two branches are logically disjoint (e.g. Branch A: customer by `o.BranchID`, Branch B: by `o.CurrentBranchID`, and an order line is only ever in one), use **UNION ALL** to avoid the duplicate-removal cost. If the same row could appear in both branches, keep `UNION`.

---

### 2.2 Temp table `#newcust`

- **Issue**: Built from the whole of `AR_NewCustomerInfor` with no index. Joined on `(BranchID, CustId)` in both branches.
- **Fix**: Add index after insert:

```sql
CREATE CLUSTERED INDEX IX_newcust ON #newcust(BranchID, CustId);
```

- **Optional**: If acceptable for your reporting window, populate `#newcust` only for customers that have orders in the date range (e.g. from a pre-aggregated list of `(BranchID, CustId)` from `OM_SalesOrd` for the same period). That reduces size and join cost.

---

### 2.3 Two branches in `UNION`

- **Issue**: The two parts of the `UNION` differ only in:
  - Branch A: `AR_Customer c` and `AR_Salesperson s` joined on `o.BranchID`.
  - Branch B: same tables joined on `o.CurrentBranchID`.
  So `OM_SalesOrd` and `OM_SalesOrdDet` are effectively scanned twice for the same date/status filter.
- **Fix**: Use a single pass over the fact data and branch only in the JOIN condition, e.g.:

  - One query from `OM_SalesOrd` / `OM_SalesOrdDet` with:
    - `LEFT JOIN AR_Customer c ON (c.BranchID = o.BranchID OR c.BranchID = o.CurrentBranchID) AND c.CustId = o.CustID`
    - and a `CASE` (or similar) to choose the “active” branch (e.g. prefer `CurrentBranchID` when it exists, else `BranchID`), then use that in all downstream lookups (salesperson, district, state, etc.).

  Or, if semantics are “either branch matches”:
  - Single query with:
    - `LEFT JOIN AR_Customer c ON c.CustId = o.CustID AND c.BranchID IN (o.BranchID, o.CurrentBranchID)`
  and then pick one row per order line (e.g. with `OUTER APPLY (SELECT TOP 1 ... ORDER BY ...)` or a small CTE) so you don’t duplicate rows.

  Consolidating to one scan of the order tables usually gives the biggest gain.

---

### 2.4 Date/time formatting and time zone

- **Issue**:
  - `FORMAT(..., 'yyyy-MM-dd''T''HH:mm:ss')` is more expensive than `CONVERT`.
  - `DATEPART(TZOFFSET, SYSDATETIMEOFFSET())` is repeated many times; the result is constant for the whole batch.
- **Fix**:
  - Compute the time zone offset once in variables, then concatenate in the SELECT.
  - Replace `FORMAT` with `CONVERT` for the same ISO-style string:

```sql
DECLARE @TZOffsetMinutes INT = DATEPART(TZOFFSET, SYSDATETIMEOFFSET());
DECLARE @TZStr VARCHAR(6) =
  CASE WHEN @TZOffsetMinutes >= 0 THEN '+' ELSE '-' END
  + RIGHT('0' + CAST(ABS(@TZOffsetMinutes / 60) AS VARCHAR(2)), 2)
  + ':' + RIGHT('00' + CAST(ABS(@TZOffsetMinutes % 60) AS VARCHAR(2)), 2);

-- In SELECT use:
[ngay_dat_hang] = CONVERT(VARCHAR(19), OrderDate, 126) + @TZStr,
[ngay_hoa_don]  = CONVERT(VARCHAR(19), ARDocDate, 126) + @TZStr,
[ngay_giao_hang]= CONVERT(VARCHAR(19), ShipDate, 126) + @TZStr,
```

`CONVERT(..., 126)` gives `yyyy-mm-ddThh:mi:ss` (no milliseconds), which matches your pattern.

---

### 2.5 Scalar UDF `dbo.fr_GetLang(@LangID, '...')`

- **Issue**: Scalar T-SQL UDFs (especially with `@LangID` and string constants) prevent batch execution and are executed row-by-row, which can dominate run time.
- **Fixes** (choose one):
  - **Inline**: If `fr_GetLang` only does a lookup (e.g. key → label), replace it with a single `LEFT JOIN` to a language table and use the column from the join (e.g. `LEFT JOIN dbo.LangLabels L ON L.LangID = @LangID AND L.LabelKey = 'SaleItem'` and similar for other keys).
  - **Persisted computed column / materialized view**: If the labels are static per language, precompute and store them.
  - **Application layer**: Load the small set of labels once (e.g. by `@LangID`) and do the “case → label” mapping in the app, and let SQL return only the key (e.g. `'SaleItem'`, `'RPFreeItem'`, …) or a tiny code; then replace the long `CASE` with a single code and map in app.

Using a join or app-side lookup avoids row-by-row UDF execution and often yields a large improvement.

---

### 2.6 Index recommendations (base tables)

Create these if they do not already exist (adjust key/include columns to your actual usage and existing indexes):

```sql
-- Core filter and join for orders
CREATE NONCLUSTERED INDEX IX_OM_SalesOrd_Status_ShipDate
ON dbo.OM_SalesOrd (Status, ShipDate)
INCLUDE (BranchID, OrderNbr, OrderDateRp, ShipDateRp, ARDocDateRp, SlsPerID, CustID, OrderType, OrigOrderNbr, CurrentBranchID, OrderDate);

-- Order lines: join and filter by order
CREATE NONCLUSTERED INDEX IX_OM_SalesOrdDet_Branch_Order
ON dbo.OM_SalesOrdDet (BranchID, OrderNbr)
INCLUDE (InvtID, LineRef, tstamp, FreeItem, LineQty, UnitRate, SlsUnit, SiteID, DisplayID, DisplayPeriodID, DiscCode, LineAmt, DocDiscAmt, GroupDiscAmt1, GroupDiscAmt2, SlsPrice, POPrice);

-- Export exclude: used in #Groups
CREATE NONCLUSTERED INDEX IX_ExportExclude_TableName
ON dbo.ServerApplication_ExportExclude (TableName) INCLUDE (CET);
```

Add or adapt indexes on:
- `AR_Customer (BranchID, CustId)` and optionally `(CurrentBranchID, CustId)` if you keep two branches.
- `AR_NewCustomerInfor (BranchID, CustId)` if you don’t pre-filter #newcust.
- Lookup tables used in JOINs: `SI_State`, `SI_District`, `SI_Ward`, `AR_Channel`, `AR_ShopType`, `AR_CustClass`, etc., on their join keys (e.g. `State`, `District`, `Ward`, `Code`, `ClassId`).

---

## 3. Execution order recommendation

1. Add indexes on `OM_SalesOrd`, `OM_SalesOrdDet`, and `ServerApplication_ExportExclude` (and lookups as above).
2. Add indexes on `#Groups` and `#newcust` immediately after their `SELECT ... INTO`.
3. Replace `FORMAT` with `CONVERT` and compute time zone offset once.
4. Replace `fr_GetLang` with a set-based lookup (join or app-side).
5. Consolidate the two UNION branches into one pass over orders (single scan, branch only in JOIN/CASE).

After each step, compare execution time and actual execution plans to confirm the gain and avoid regressions.

---

## 4. Optional: further reductions

- **NOLOCK**: You use `WITH (NOLOCK)` everywhere. If acceptable, consider `READ UNCOMMITTED` at the session level and dropping hints to simplify the script; measure to ensure no negative impact.
- **Narrow #Groups**: Ensure the query that builds `#Groups` only returns columns you need; avoid `SELECT *` if it were used.
- **Statistics**: After creating indexes, run `UPDATE STATISTICS` on the main tables (or rely on your maintenance job) so the optimizer can choose the new indexes effectively.

If you share the actual execution plan (or the part that shows the highest cost), the recommendations can be tightened further (e.g. which of the two UNION branches dominates, or whether the bottleneck is in `#Groups` vs. order table scan).
