import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContextMenu from "components/landingPage/ContextMenu";
import createLoadedComponent from "__tests__/utilities/customRender";

it("ContextMenu editable and shared", async () => {
  const setIsEditingTitle = jest.fn();
  const setIsEditingDescription = jest.fn();
  const onDelete = jest.fn();
  const onCopy = jest.fn();
  const viewDashboard = jest.fn();
  const onShare = jest.fn();
  const onCopyPublicLink = jest.fn();
  const setShowThumbnailModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <ContextMenu
          editable={true}
          setIsEditingTitle={setIsEditingTitle}
          setIsEditingDescription={setIsEditingDescription}
          onDelete={onDelete}
          onCopy={onCopy}
          viewDashboard={viewDashboard}
          onShare={onShare}
          onCopyPublicLink={onCopyPublicLink}
          shared={true}
          setShowThumbnailModal={setShowThumbnailModal}
        />
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const openOption = await screen.findByText("Open");
  expect(openOption).toBeInTheDocument();
  await userEvent.click(openOption);
  expect(viewDashboard).toHaveBeenCalled();

  const renameOption = await screen.findByText("Rename");
  expect(renameOption).toBeInTheDocument();
  await userEvent.click(renameOption);
  expect(setIsEditingTitle).toHaveBeenCalledWith(true);

  const updateDescriptionOption = await screen.findByText("Update Description");
  expect(updateDescriptionOption).toBeInTheDocument();
  await userEvent.click(updateDescriptionOption);
  expect(setIsEditingDescription).toHaveBeenCalledWith(true);

  const updateThumbnailOption = await screen.findByText("Update Thumbnail");
  expect(updateThumbnailOption).toBeInTheDocument();
  await userEvent.click(updateThumbnailOption);
  expect(setShowThumbnailModal).toHaveBeenCalledWith(true);

  const copyOption = await screen.findByText("Copy");
  expect(copyOption).toBeInTheDocument();
  await userEvent.click(copyOption);
  expect(onCopy).toHaveBeenCalled();

  const deleteOption = await screen.findByText("Delete");
  expect(deleteOption).toBeInTheDocument();
  await userEvent.click(deleteOption);
  expect(onDelete).toHaveBeenCalled();

  const shareOption = await screen.findByText("Share");
  expect(shareOption).toBeInTheDocument();
  await userEvent.hover(shareOption);

  const makePrivateOption = await screen.findByText("Make Private");
  expect(makePrivateOption).toBeInTheDocument();
  await userEvent.click(makePrivateOption);
  expect(onShare).toHaveBeenCalled();

  const copyPublicURLOption = await screen.findByText("Copy Public URL");
  expect(copyPublicURLOption).toBeInTheDocument();
  await userEvent.click(copyPublicURLOption);
  expect(onCopyPublicLink).toHaveBeenCalled();
});

it("ContextMenu editable and not shared", async () => {
  const setIsEditingTitle = jest.fn();
  const setIsEditingDescription = jest.fn();
  const onDelete = jest.fn();
  const onCopy = jest.fn();
  const viewDashboard = jest.fn();
  const onShare = jest.fn();
  const onCopyPublicLink = jest.fn();
  const setShowThumbnailModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <ContextMenu
          editable={true}
          setIsEditingTitle={setIsEditingTitle}
          setIsEditingDescription={setIsEditingDescription}
          onDelete={onDelete}
          onCopy={onCopy}
          viewDashboard={viewDashboard}
          onShare={onShare}
          onCopyPublicLink={onCopyPublicLink}
          shared={false}
          setShowThumbnailModal={setShowThumbnailModal}
        />
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const openOption = await screen.findByText("Open");
  expect(openOption).toBeInTheDocument();
  await userEvent.click(openOption);
  expect(viewDashboard).toHaveBeenCalled();

  const renameOption = await screen.findByText("Rename");
  expect(renameOption).toBeInTheDocument();
  await userEvent.click(renameOption);
  expect(setIsEditingTitle).toHaveBeenCalledWith(true);

  const updateDescriptionOption = await screen.findByText("Update Description");
  expect(updateDescriptionOption).toBeInTheDocument();
  await userEvent.click(updateDescriptionOption);
  expect(setIsEditingDescription).toHaveBeenCalledWith(true);

  const updateThumbnailOption = await screen.findByText("Update Thumbnail");
  expect(updateThumbnailOption).toBeInTheDocument();
  await userEvent.click(updateThumbnailOption);
  expect(setShowThumbnailModal).toHaveBeenCalledWith(true);

  const copyOption = await screen.findByText("Copy");
  expect(copyOption).toBeInTheDocument();
  await userEvent.click(copyOption);
  expect(onCopy).toHaveBeenCalled();

  const deleteOption = await screen.findByText("Delete");
  expect(deleteOption).toBeInTheDocument();
  await userEvent.click(deleteOption);
  expect(onDelete).toHaveBeenCalled();

  const shareOption = await screen.findByText("Share");
  expect(shareOption).toBeInTheDocument();
  const subMenu = screen.getByLabelText("Context Menu Submenu");
  expect(window.getComputedStyle(subMenu).display).toBe("none");
  fireEvent.mouseEnter(shareOption);

  const makePublicOption = await screen.findByText("Make Public");
  expect(makePublicOption).toBeInTheDocument();
  expect(window.getComputedStyle(subMenu).display).toBe("block");
  await userEvent.click(makePublicOption);
  expect(onShare).toHaveBeenCalled();

  fireEvent.mouseLeave(shareOption);
  expect(window.getComputedStyle(subMenu).display).toBe("none");
});

it("ContextMenu not editable and shared", async () => {
  const setIsEditingTitle = jest.fn();
  const setIsEditingDescription = jest.fn();
  const onDelete = jest.fn();
  const onCopy = jest.fn();
  const viewDashboard = jest.fn();
  const onShare = jest.fn();
  const onCopyPublicLink = jest.fn();
  const setShowThumbnailModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <ContextMenu
          editable={false}
          setIsEditingTitle={setIsEditingTitle}
          setIsEditingDescription={setIsEditingDescription}
          onDelete={onDelete}
          onCopy={onCopy}
          viewDashboard={viewDashboard}
          onShare={onShare}
          onCopyPublicLink={onCopyPublicLink}
          shared={true}
          setShowThumbnailModal={setShowThumbnailModal}
        />
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const openOption = await screen.findByText("Open");
  expect(openOption).toBeInTheDocument();
  await userEvent.click(openOption);
  expect(viewDashboard).toHaveBeenCalled();

  expect(screen.queryByText("Rename")).not.toBeInTheDocument();
  expect(screen.queryByText("Update Description")).not.toBeInTheDocument();
  expect(screen.queryByText("Update Thumbnail")).not.toBeInTheDocument();
  expect(screen.queryByText("Delete")).not.toBeInTheDocument();

  const copyOption = await screen.findByText("Copy");
  expect(copyOption).toBeInTheDocument();
  await userEvent.click(copyOption);
  expect(onCopy).toHaveBeenCalled();

  const shareOption = await screen.findByText("Share");
  expect(shareOption).toBeInTheDocument();
  await userEvent.hover(shareOption);

  const copyPublicURLOption = await screen.findByText("Copy Public URL");
  expect(copyPublicURLOption).toBeInTheDocument();
  await userEvent.click(copyPublicURLOption);
  expect(onCopyPublicLink).toHaveBeenCalled();
});

it("ContextMenu not overflowing submenu", async () => {
  const setIsEditingTitle = jest.fn();
  const setIsEditingDescription = jest.fn();
  const onDelete = jest.fn();
  const onCopy = jest.fn();
  const viewDashboard = jest.fn();
  const onShare = jest.fn();
  const onCopyPublicLink = jest.fn();
  const setShowThumbnailModal = jest.fn();

  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    right: window.innerWidth - 100, // Simulate element fitting within viewport
  }));

  render(
    createLoadedComponent({
      children: (
        <ContextMenu
          editable={false}
          setIsEditingTitle={setIsEditingTitle}
          setIsEditingDescription={setIsEditingDescription}
          onDelete={onDelete}
          onCopy={onCopy}
          viewDashboard={viewDashboard}
          onShare={onShare}
          onCopyPublicLink={onCopyPublicLink}
          shared={true}
          setShowThumbnailModal={setShowThumbnailModal}
        />
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const shareOption = await screen.findByText("Share");
  expect(shareOption).toBeInTheDocument();
  const subMenu = screen.getByLabelText("Context Menu Submenu");
  fireEvent.mouseEnter(shareOption);

  expect(window.getComputedStyle(subMenu).display).toBe("block");
  expect(window.getComputedStyle(subMenu).left).toBe("100%");
  expect(window.getComputedStyle(subMenu).right).toBe("");
});

it("ContextMenu overflowing submenu", async () => {
  const setIsEditingTitle = jest.fn();
  const setIsEditingDescription = jest.fn();
  const onDelete = jest.fn();
  const onCopy = jest.fn();
  const viewDashboard = jest.fn();
  const onShare = jest.fn();
  const onCopyPublicLink = jest.fn();
  const setShowThumbnailModal = jest.fn();

  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    right: window.innerWidth + 10, // Simulate overflow (element extends past window width)
  }));

  render(
    createLoadedComponent({
      children: (
        <ContextMenu
          editable={false}
          setIsEditingTitle={setIsEditingTitle}
          setIsEditingDescription={setIsEditingDescription}
          onDelete={onDelete}
          onCopy={onCopy}
          viewDashboard={viewDashboard}
          onShare={onShare}
          onCopyPublicLink={onCopyPublicLink}
          shared={true}
          setShowThumbnailModal={setShowThumbnailModal}
        />
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const shareOption = await screen.findByText("Share");
  expect(shareOption).toBeInTheDocument();
  const subMenu = screen.getByLabelText("Context Menu Submenu");
  fireEvent.mouseEnter(shareOption);

  expect(window.getComputedStyle(subMenu).display).toBe("block");
  expect(window.getComputedStyle(subMenu).left).toBe("");
  expect(window.getComputedStyle(subMenu).right).toBe("100%");
});
