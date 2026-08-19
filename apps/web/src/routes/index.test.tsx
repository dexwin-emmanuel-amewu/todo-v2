import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomePage } from "./index";

describe("HomePage", () => {
  it("renders the placeholder heading", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "Todo" })).toBeInTheDocument();
  });
});
