const { parseUtcTimestamp } = require("../src/server/time");

describe("time parsing", () => {
  it("parses UTC timestamps with explicit offset", () => {
    const parsed = parseUtcTimestamp("2026-02-25T18:00:00.000Z", "visibleFromUtc");
    expect(parsed).toBeInstanceOf(Date);
  });

  it("rejects timestamps without explicit offset", () => {
    expect(() => parseUtcTimestamp("2026-02-25T18:00:00", "visibleFromUtc")).toThrow(
      "must include a UTC offset"
    );
  });
});
