import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Confirmation } from "components/inputs/Confirmation";

describe("Confirmation Component", () => {
  const defaultProps = {
    show: true,
    proceed: jest.fn(),
    confirmation: <div>Are you sure you want to continue?</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders modal with default props", () => {
    render(<Confirmation {...defaultProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirmation")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to continue?"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ok/i })).toBeInTheDocument();
  });

  test("renders with custom title", () => {
    render(
      <Confirmation {...defaultProps} title="Custom Confirmation Title" />,
    );

    expect(screen.getByText("Custom Confirmation Title")).toBeInTheDocument();
  });

  test("renders with custom button labels", () => {
    render(
      <Confirmation {...defaultProps} okLabel="Confirm" cancelLabel="Abort" />,
    );

    expect(
      screen.getByRole("button", { name: /confirm/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /abort/i })).toBeInTheDocument();
  });

  test("does not render when show is false", () => {
    render(<Confirmation {...defaultProps} show={false} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("calls proceed with true when OK button is clicked", async () => {
    const user = userEvent.setup();
    const mockProceed = jest.fn();

    render(<Confirmation {...defaultProps} proceed={mockProceed} />);

    const okButton = screen.getByRole("button", { name: /ok/i });
    await user.click(okButton);

    expect(mockProceed).toHaveBeenCalledWith(true);
    expect(mockProceed).toHaveBeenCalledTimes(1);
  });

  test("calls proceed with false when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const mockProceed = jest.fn();

    render(<Confirmation {...defaultProps} proceed={mockProceed} />);

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockProceed).toHaveBeenCalledWith(false);
    expect(mockProceed).toHaveBeenCalledTimes(1);
  });

  test("calls proceed with false when modal is hidden via onHide", async () => {
    const user = userEvent.setup();
    const mockProceed = jest.fn();

    render(<Confirmation {...defaultProps} proceed={mockProceed} />);

    // Simulate pressing Escape key which triggers onHide
    await user.keyboard("{Escape}");

    expect(mockProceed).toHaveBeenCalledWith(false);
  });

  test("does not render Cancel button when noCancel is true", () => {
    render(<Confirmation {...defaultProps} noCancel={true} />);

    expect(
      screen.queryByRole("button", { name: /cancel/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ok/i })).toBeInTheDocument();
  });

  test("renders with custom confirmation content", () => {
    const customConfirmation = (
      <div>
        <h4>Warning!</h4>
        <p>This action cannot be undone.</p>
      </div>
    );

    render(
      <Confirmation {...defaultProps} confirmation={customConfirmation} />,
    );

    expect(screen.getByText("Warning!")).toBeInTheDocument();
    expect(
      screen.getByText("This action cannot be undone."),
    ).toBeInTheDocument();
  });

  test("renders with static backdrop", () => {
    render(<Confirmation {...defaultProps} backdrop="static" />);

    const modal = screen.getByRole("dialog");
    expect(modal).toBeInTheDocument();
    // The backdrop="static" prop is passed to the Modal component
    // We can't easily test the backdrop behavior in jsdom, but we can verify the modal renders
  });

  test("renders with backdrop disabled", () => {
    render(<Confirmation {...defaultProps} backdrop={false} />);

    const modal = screen.getByRole("dialog");
    expect(modal).toBeInTheDocument();
  });

  test("OK button has correct styling classes", () => {
    render(<Confirmation {...defaultProps} />);

    const okButton = screen.getByRole("button", { name: /ok/i });
    expect(okButton).toHaveClass("button-l");
    expect(okButton).toHaveClass("btn-primary");
  });

  test("handles keyboard interaction correctly", async () => {
    const user = userEvent.setup();
    const mockProceed = jest.fn();

    render(<Confirmation {...defaultProps} proceed={mockProceed} />);

    // Tab to OK button and press Enter
    await user.tab();
    await user.tab(); // Should be on OK button
    await user.keyboard("{Enter}");

    expect(mockProceed).toHaveBeenCalledWith(true);
  });

  test("renders with all custom props", () => {
    const customProps = {
      ...defaultProps,
      title: "Delete Item",
      okLabel: "Delete",
      cancelLabel: "Keep",
      confirmation: <span>This will permanently delete the item.</span>,
      backdrop: "static",
      noCancel: false,
    };

    render(<Confirmation {...customProps} />);

    expect(screen.getByText("Delete Item")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /keep/i })).toBeInTheDocument();
    expect(
      screen.getByText("This will permanently delete the item."),
    ).toBeInTheDocument();
  });

  test("renders modal body with confirmation content", () => {
    render(<Confirmation {...defaultProps} />);

    // The OverflowBody is a styled Modal.Body component that contains the confirmation content
    // We can verify the confirmation content is rendered within the modal
    expect(
      screen.getByText("Are you sure you want to continue?"),
    ).toBeInTheDocument();
  });

  test("passes additional props to Modal component", () => {
    const customProps = {
      ...defaultProps,
      size: "lg",
      centered: true,
      "data-testid": "custom-modal",
    };

    render(<Confirmation {...customProps} />);

    const modal = screen.getByTestId("custom-modal");
    expect(modal).toBeInTheDocument();
  });
});
