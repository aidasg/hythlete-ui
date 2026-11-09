import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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
          <details><summary>All intervals</summary><button>Hidden interval</button></details>
        </WorkoutModal>
      )}
    </>
  );
}

describe("WorkoutModal", () => {
  it("blocks all dismissal methods when an import becomes busy", () => {
    const onClose = vi.fn();
    const { container, rerender } = render(<WorkoutModal title="Import activities" eyebrow="Import" onClose={onClose}><button>Import</button></WorkoutModal>);
    rerender(<WorkoutModal title="Import activities" eyebrow="Import" onClose={onClose} dismissDisabled><button>Import</button></WorkoutModal>);
    expect(screen.getByRole('button', {name:'Close modal'})).toBeDisabled();
    fireEvent.keyDown(window, {key:'Escape'});
    fireEvent.mouseDown(container.querySelector('.workout-modal-backdrop')!);
    expect(onClose).not.toHaveBeenCalled();
    rerender(<WorkoutModal title="Import activities" eyebrow="Import" onClose={onClose}><button>Import</button></WorkoutModal>);
    fireEvent.keyDown(window, {key:'Escape'});
    expect(onClose).toHaveBeenCalledOnce();
  });
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
  it("traps focus around visible controls, including collapsed interval disclosures", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole('button', {name:'Open preview'}));
    const summary = screen.getByText('All intervals');
    summary.focus();
    await user.tab();
    expect(screen.getByRole('button', {name:'Close modal'})).toHaveFocus();
    await user.tab({shift:true});
    expect(summary).toHaveFocus();
  });

});

