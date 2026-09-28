import { describe, expect, it } from "vitest";
import {
  containsForbiddenWord,
  findForbiddenWords,
  forbiddenWordError,
} from "./forbidden-words";

describe("findForbiddenWords", () => {
  it("catches the wording TfL forbids, in prose and in slugs", () => {
    expect(containsForbiddenWord("Heathrow taxi to central London")).toBe(true);
    expect(containsForbiddenWord("heathrow-taxi-transfers")).toBe(true);
    expect(containsForbiddenWord("Book a cab")).toBe(true);
    expect(containsForbiddenWord("Cheap minicabs from Gatwick")).toBe(true);
    expect(containsForbiddenWord("black cab tours")).toBe(true);
    expect(containsForbiddenWord("Our cabbies are licensed")).toBe(true);
  });

  it("does not fire on innocent words that merely contain them", () => {
    expect(containsForbiddenWord("Cabin luggage allowance")).toBe(false);
    expect(containsForbiddenWord("Taxidermy museum tour")).toBe(false);
    expect(containsForbiddenWord("The cabinet is locked")).toBe(false);
    expect(containsForbiddenWord("Caberet")).toBe(false);
  });

  it("passes correct Cityline wording", () => {
    expect(containsForbiddenWord("Heathrow airport transfers")).toBe(false);
    expect(containsForbiddenWord("Licensed private hire with a chauffeur")).toBe(false);
    expect(containsForbiddenWord("")).toBe(false);
  });

  it("reports every hit with its position so the admin can highlight it", () => {
    const hits = findForbiddenWords("Taxi or cab, your choice");
    expect(hits.map((h) => h.word)).toEqual(["taxi", "cab"]);
    expect(hits[0]?.index).toBe(0);
    expect(hits[1]?.index).toBe(8);
  });
});

describe("forbiddenWordError", () => {
  it("returns null for clean copy", () => {
    expect(forbiddenWordError("Gatwick to Brighton transfer")).toBeNull();
  });

  it("names the field and the offending words", () => {
    const error = forbiddenWordError("Luton taxi", "Meta description");
    expect(error).toContain("Meta description");
    expect(error).toContain("taxi");
    expect(error).toContain("CMP-01");
  });
});
