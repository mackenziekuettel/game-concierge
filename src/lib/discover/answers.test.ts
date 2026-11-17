import { describe, expect, it } from "vitest";
import { answersToQuery, parseAnswers } from "./answers";

describe("answers in the URL", () => {
  it("round-trips answers so results survive a reload or the back button", () => {
    const answers = {
      players: "2",
      length: "short",
      learn: "quick",
      complexity: "light",
      loved: ["Ticket to Ride"],
    } as const;
    expect(parseAnswers(new URLSearchParams(answersToQuery({ ...answers, loved: [...answers.loved] })))).toEqual(
      answers,
    );
  });

  it("rejects incomplete or unknown answers instead of guessing", () => {
    expect(parseAnswers(new URLSearchParams("p=2&t=short&l=quick"))).toBeNull();
    expect(parseAnswers(new URLSearchParams("p=9&t=short&l=quick&c=light"))).toBeNull();
  });
});
