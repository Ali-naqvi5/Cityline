import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

const columns = [
  { header: "Name", value: (row: { name: string; n: number }) => row.name },
  { header: "Count", value: (row: { name: string; n: number }) => row.n },
];

describe("toCsv", () => {
  it("writes a header and rows, with a byte-order mark and CRLF", () => {
    expect(toCsv([{ name: "Jane", n: 2 }], columns)).toBe(
      "\uFEFFName,Count\r\nJane,2\r\n",
    );
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv([{ name: 'Smith, "Jo"\nRoom 2', n: 1 }], columns)).toContain(
      '"Smith, ""Jo""\nRoom 2",1',
    );
  });

  it("stops a cell from becoming a spreadsheet formula", () => {
    const csv = toCsv([{ name: '=HYPERLINK("http://x")', n: -5 }], columns);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")",-5`);
    expect(toCsv([{ name: "+44 7700 900123", n: 0 }], columns)).toContain(
      "'+44 7700 900123,0",
    );
  });

  it("leaves empty values empty", () => {
    expect(
      toCsv([{ name: null as unknown as string, n: Number.NaN }], columns).split(
        "\r\n",
      )[1],
    ).toBe(",");
  });
});
