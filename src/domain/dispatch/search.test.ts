import { describe, expect, it } from "vitest";

import { matchScore, rankMatches } from "./search";

const sam = ["Sam Taylor", "AB12 CDE", "Mercedes", "E-Class", "Black"];
const priya = ["Priya Shah", "LV70 XYZ", "Ford", "Galaxy", "Silver"];

describe("matchScore", () => {
  it("finds a driver by name, whole or in part", () => {
    expect(matchScore("sam", sam)).toBeGreaterThan(0);
    expect(matchScore("taylor", sam)).toBeGreaterThan(0);
    expect(matchScore("sam taylor", sam)).toBeGreaterThan(matchScore("sam", sam));
  });

  it("finds a car by registration, with or without the space", () => {
    expect(matchScore("ab12cde", sam)).toBe(1000);
    expect(matchScore("AB12 CDE", sam)).toBe(1000);
    expect(matchScore("cde", sam)).toBeGreaterThan(0);
  });

  it("finds a car by make or model", () => {
    expect(matchScore("galaxy", priya)).toBeGreaterThan(0);
    expect(matchScore("eclass", sam)).toBeGreaterThan(0);
  });

  it("needs every word to match something", () => {
    expect(matchScore("sam galaxy", sam)).toBe(0);
    expect(matchScore("priya galaxy", priya)).toBeGreaterThan(0);
  });

  it("forgives a slip of the finger, but ranks it below a true match", () => {
    expect(matchScore("tylor", sam)).toBeGreaterThan(0);
    expect(matchScore("tylor", sam)).toBeLessThan(matchScore("taylor", sam));
    expect(matchScore("zz", sam)).toBe(0);
  });

  it("matches everything when nothing is typed", () => {
    expect(matchScore("  ", sam)).toBe(1);
  });
});

describe("rankMatches", () => {
  it("puts the closest match first and drops the rest", () => {
    const people = [
      { name: "Samir Patel", plate: "SA11 AAA" },
      { name: "Sam Taylor", plate: "AB12 CDE" },
      { name: "Priya Shah", plate: "LV70 XYZ" },
    ];
    const found = rankMatches(people, "sam taylor", (person) => [
      person.name,
      person.plate,
    ]);
    expect(found.map((person) => person.name)).toEqual(["Sam Taylor"]);
    expect(
      rankMatches(people, "sa", (person) => [person.name, person.plate]).map(
        (person) => person.name,
      ),
    ).toEqual(["Samir Patel", "Sam Taylor"]);
  });
});
