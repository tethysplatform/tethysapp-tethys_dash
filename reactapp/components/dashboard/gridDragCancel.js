// In dashboard edit mode a whole tile is a drag handle for moving it around the
// grid, so a press anywhere inside it starts a move. An element carrying this
// class (or inside one) is left out: a press there stays a press, for
// controls that work while the dashboard is being edited. DashboardLayout lists
// it in react-grid-layout's `draggableCancel`.
export const GRID_DRAG_CANCEL_CLASS = "grid-drag-cancel";
