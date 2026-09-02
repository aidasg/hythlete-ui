import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { WorkoutModal } from "@/features/workouts/components/WorkoutModal";

function ModalHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open preview
      </button>
      {isOpen && (
        <WorkoutModal
          eyebrow="Recommendation"
          title="Review workout"
          onClose={() => setIsOpen(false)}
        >
          <button type="button">Save workout</button>
        </WorkoutModal>
      )}
    </>
  );
}

describe("WorkoutModal", () => {
  it("closes with Escape and restores focus to its trigger", async () => {
    const user = userEvent.setup();

    render(<ModalHarness />);
    const trigger = screen.getByRole("button", { name: "Open preview" });

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Review workout" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

