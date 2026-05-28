import { createContext } from "react";

export const AppContext = createContext();
export const PermissionGroupContext = createContext();
export const VariableInputsContext = createContext();
export const LayoutContext = createContext();
export const AvailableDashboardsContext = createContext();
export const EditingContext = createContext();
export const DisabledEditingMovementContext = createContext();
export const DataViewerModeContext = createContext();
export const AppTourContext = createContext();
export const MapContext = createContext();
export const TabContext = createContext();
export const GridItemContext = createContext();

// Plan 2026-05-28-002 Unit 6 — streaming-state for chatbox-driven tile work.
// Owned by DashboardLoader (listens for tethysdash:turn-start / tethysdash:turn-end
// window events from @aquaveo/chatbox-core@>=0.16.0-beta.0). Consumed ONLY by
// DashboardItem to gate per-tile edit/delete/reorder affordances while the
// chatbox is mutating tiles via patch_visualization.
//
// Dedicated context rather than extending DisabledEditingMovementContext to
// avoid a re-render fan-out across the 4+ consumers of that context (Header,
// DashboardLayout, PopupLayoutEditor, DashboardItem) on every turn boundary.
// Per-turn flips only re-render DashboardItem instances here.
//
// Value shape: { isStreaming: boolean, setIsStreaming: (bool) => void }
export const StreamingContext = createContext();
