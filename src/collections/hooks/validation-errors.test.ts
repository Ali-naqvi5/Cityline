import type { AfterErrorHookArgs } from "payload";
import { describe, expect, it } from "vitest";

import { keepValidationMessages } from "./validation-errors";

const run = (error: Error, result?: AfterErrorHookArgs["result"]) =>
  keepValidationMessages({ error, result } as AfterErrorHookArgs);

function validationError(errors: unknown[]) {
  return Object.assign(new Error("The following field is invalid: source"), {
    status: 400,
    data: { collection: "jobs", errors },
  });
}

describe("validation errors over the API", () => {
  it("puts the field messages back when Payload left them out", () => {
    const error = validationError([
      {
        path: "source",
        message: "Website jobs are created by the website checkout only.",
      },
    ]);
    const result = run(error, { errors: [{ message: error.message }] });
    expect(result).toEqual({
      response: {
        errors: [
          {
            name: "ValidationError",
            message: "The following field is invalid: source",
            data: error.data,
          },
        ],
      },
    });
  });

  it("leaves a response that already has them", () => {
    const error = validationError([{ path: "source", message: "No." }]);
    expect(
      run(error, { errors: [{ message: error.message, data: error.data }] }),
    ).toBeUndefined();
  });

  it("never touches other errors", () => {
    const internal = Object.assign(new Error("connection refused"), {
      status: 500,
      data: { errors: [{ message: "secret detail" }] },
    });
    expect(
      run(internal, { errors: [{ message: "Something went wrong." }] }),
    ).toBeUndefined();
    expect(
      run(new Error("Not found"), { errors: [{ message: "Not found" }] }),
    ).toBeUndefined();
    expect(
      run(validationError([]), { errors: [{ message: "invalid" }] }),
    ).toBeUndefined();
  });
});
