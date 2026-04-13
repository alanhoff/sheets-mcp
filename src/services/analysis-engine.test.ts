import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeValueRanges } from "#services/analysis-engine.ts";

describe("analysis engine", () => {
  it("profiles columns and detects duplicate keys with header-aware analysis", () => {
    const result = analyzeValueRanges(
      [
        {
          range: "Sheet1!A1:C5",
          values: [
            ["id", "amount", "status"],
            [1, 10, "ok"],
            [2, 20, "ok"],
            [2, "", ""],
            [4, 1000, "ok"],
          ],
        },
      ],
      {
        hasHeaderRow: true,
        duplicateKeyColumns: [0],
        sampleSize: 3,
        outlierZScoreThreshold: 1.2,
      },
    );

    assert.equal(result.summary.range_count, 1);
    assert.equal(result.summary.row_count, 4);
    assert.equal(result.summary.duplicate_row_count, 1);

    const [range] = result.ranges;
    assert.equal(range.column_count, 3);
    assert.equal(range.duplicate_summary?.duplicate_key_count, 1);
    assert.equal(range.duplicate_summary?.duplicate_row_count, 1);

    const amountColumn = range.columns[1];
    assert.equal(amountColumn.header, "amount");
    assert.equal(amountColumn.inferred_type, "number");
    assert.equal(amountColumn.null_count, 1);
    assert.equal(amountColumn.non_null_count, 3);
    assert.equal(amountColumn.distinct_count, 3);
    assert.equal(amountColumn.outlier_hints?.count, 1);
  });

  it("handles mixed-type ranges without headers", () => {
    const result = analyzeValueRanges(
      [
        {
          range: "Sheet2!A1:B4",
          values: [[1, true], ["x", false], [2]],
        },
      ],
      {
        hasHeaderRow: false,
        sampleSize: 2,
      },
    );

    const [range] = result.ranges;
    assert.equal(range.row_count, 3);
    assert.equal(range.column_count, 2);
    assert.equal(range.columns[0].inferred_type, "mixed");
    assert.equal(range.columns[1].inferred_type, "boolean");
    assert.equal(range.warnings.includes("Rows have inconsistent column counts."), true);
  });
});
