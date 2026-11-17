import { useId, useRef, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import {
  FaPencilAlt,
  FaTimes,
  FaTrashAlt,
  FaChevronDown,
  FaChevronRight,
  FaPlus,
} from "react-icons/fa";
import FloatingMapControl, {
  MapSizedControlContainer,
} from "components/map/FloatingMapControl";
import AnnotationEditor from "components/map/AnnotationEditor";
import AnnotationStyleControl, {
  FIELDS_BY_KIND,
  FIELD_LABELS,
} from "components/inputs/AnnotationStyleControl";
import {
  DEFAULT_ARROWHEAD_OPTIONS,
  resolveAnnotationDefaults,
} from "components/map/annotations";
import {
  annotationGroupLayerName,
  groupNameError,
  nextGroupName,
} from "components/map/annotationGroups";

// The dashboard's annotation button: a map control, like the layers list and
// the legend, that lists the map's annotation groups and starts drawing into
// one directly on the map. It is mounted only while the dashboard is being
// edited, by a map that can write its own settings (see visualizations/Map.js),
// which owns the groups and the session; this component only presents them.
//
// Every change goes out through `onGroupsChange` at once, into the dashboard's
// unsaved edits: the header's Save keeps it and its Cancel throws it away, as
// for any other edit. A drawing session's own Cancel puts back the group as it
// was when the session started.

// Top-right: the layers list and the legend hold the bottom corners. Moves to
// the button layout setting once that exists.
const ControlWrapper = styled(FloatingMapControl)`
  position: absolute;
  top: 1rem;
  right: 1rem;
`;

const Container = styled.div`
  background-color: white;
  padding: ${(props) => (props.$isexpanded ? "10px" : "5px")};
  z-index: 1000;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: ${(props) => (props.$isexpanded ? "18rem" : "40px")};
  max-width: calc(100vw - 2rem);
  max-height: ${(props) => props.$maxheight};
  height: ${(props) => (props.$isexpanded ? "auto" : "40px")};
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: ${(props) => (props.$isexpanded ? "auto" : "visible")};
`;

const IconButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  color: #444;
  line-height: 1;

  &:hover:not(:disabled) {
    color: #000;
  }
`;

const ToggleButton = styled(IconButton)`
  font-size: 18px;
`;

const CloseButton = styled(IconButton)`
  font-size: 18px;
  position: absolute;
  top: 5px;
  right: 5px;
`;

const Help = styled.p`
  color: #6c757d;
  font-size: 0.85rem;
  margin: 0.5rem 0;
`;

const GroupList = styled.ul`
  list-style: none;
  margin: 0.75rem 0 0.5rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const GroupRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const GroupName = styled.span`
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-weight: 500;
`;

const TextButton = styled.button`
  border: 1px solid #1f6feb;
  background: white;
  color: #1f6feb;
  border-radius: 3px;
  padding: 1px 8px;
  font-size: 0.85rem;
  cursor: pointer;

  &:hover {
    background: #eef4ff;
  }
`;

const DangerButton = styled(TextButton)`
  border-color: #b42318;
  color: #b42318;

  &:hover {
    background: #fdecea;
  }
`;

const NameInput = styled.input`
  flex: 1;
  min-width: 0;
  font-size: 0.9rem;
  padding: 1px 4px;
`;

const ErrorText = styled.div`
  color: #b42318;
  font-size: 0.8rem;
  margin-top: 2px;
`;

const Confirm = styled.div`
  background: #fdecea;
  border-radius: 3px;
  padding: 6px 8px;
  margin-top: 4px;
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 6px;
`;

const DefaultsToggle = styled.button`
  background: none;
  border: none;
  padding: 0;
  margin-top: 2px;
  font-size: 0.8rem;
  color: #444;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Defaults = styled.div`
  border-left: 2px solid #e3e6ea;
  margin: 4px 0 0 4px;
  padding-left: 8px;
`;

const DefaultsTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  margin: 6px 0 4px;
`;

const Field = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
  font-size: 0.85rem;
`;

const AddButton = styled(TextButton)`
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const DEFAULT_SECTIONS = [
  { key: "line", title: "Lines and arrows" },
  { key: "text", title: "Text" },
];

const replaceGroup = (groups, name, update) =>
  groups.map((group) => (group.name === name ? update(group) : group));

const AnnotationControl = ({
  visualizationRef,
  mapDivRef,
  groups,
  onGroupsChange,
  session,
  onSessionChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  // The group being renamed: {name, value, error}.
  const [renaming, setRenaming] = useState(null);
  // The group whose delete is waiting for confirmation.
  const [confirmingDelete, setConfirmingDelete] = useState(null);
  // The group whose default styles are showing; one at a time.
  const [defaultsOpen, setDefaultsOpen] = useState(null);
  const containerRef = useRef(null);
  // Ids for linking each row's error message to its name field.
  const idBase = useId();
  // The editor reports changes through handlers bound when its session
  // started; they must write into the groups as they are now.
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const writeItems = (groupName, items) =>
    onGroupsChange(
      replaceGroup(groupsRef.current, groupName, (group) => ({
        ...group,
        items,
      })),
    );

  if (session) {
    return (
      <AnnotationEditor
        visualizationRef={visualizationRef}
        session={session}
        onChange={(items) => writeItems(session.groupName, items)}
        onDone={(items) => {
          writeItems(session.groupName, items);
          onSessionChange(null);
        }}
        onCancel={() => {
          writeItems(session.groupName, session.startItems);
          onSessionChange(null);
        }}
      />
    );
  }

  const startDrawing = (group) => {
    setRenaming(null);
    setConfirmingDelete(null);
    // Kept stable for the whole session: the editor sets itself up once per
    // session object, and its changes go out through onChange, not back in.
    onSessionChange({
      groupName: group.name,
      layerName: annotationGroupLayerName(group.name),
      title: group.name,
      defaults: group.defaults,
      items: group.items,
      startItems: group.items,
    });
  };

  const addGroup = () => {
    onGroupsChange([
      ...groups,
      { name: nextGroupName(groups), defaults: {}, items: [] },
    ]);
  };

  const commitRename = () => {
    const error = groupNameError(renaming.value, groups, renaming.name);
    if (error) {
      setRenaming({ ...renaming, error });
      return;
    }
    const name = renaming.value.trim();
    if (name !== renaming.name) {
      onGroupsChange(
        replaceGroup(groups, renaming.name, (group) => ({ ...group, name })),
      );
      if (defaultsOpen === renaming.name) setDefaultsOpen(name);
    }
    setRenaming(null);
  };

  const deleteGroup = (name) => {
    onGroupsChange(groups.filter((group) => group.name !== name));
    setConfirmingDelete(null);
    if (defaultsOpen === name) setDefaultsOpen(null);
  };

  const requestDelete = (group) => {
    if (group.items.length === 0) {
      deleteGroup(group.name);
    } else {
      setConfirmingDelete(group.name);
    }
  };

  const setDefault = (groupName, field, value) => {
    onGroupsChange(
      replaceGroup(groups, groupName, (group) => {
        const defaults = { ...group.defaults };
        if (value === undefined) {
          delete defaults[field];
        } else {
          defaults[field] = value;
        }
        return { ...group, defaults };
      }),
    );
  };

  const renderDefaults = (group) => {
    const resolved = resolveAnnotationDefaults(group.defaults);
    return (
      <Defaults
        role="group"
        aria-label={`${group.name} default style settings`}
      >
        {DEFAULT_SECTIONS.map(({ key, title }) => (
          <div key={key}>
            <DefaultsTitle>{title}</DefaultsTitle>
            {FIELDS_BY_KIND[key].map((field) => (
              <Field key={field}>
                <span>{FIELD_LABELS[field]}</span>
                <AnnotationStyleControl
                  field={field}
                  value={resolved[field]}
                  storedValue={group.defaults[field]}
                  onChange={(value) => setDefault(group.name, field, value)}
                  ariaPrefix="Default "
                  containerRef={containerRef}
                  arrowheadOptions={DEFAULT_ARROWHEAD_OPTIONS}
                  compactAnchor
                />
              </Field>
            ))}
          </div>
        ))}
      </Defaults>
    );
  };

  const renderGroup = (group, index) => {
    const isRenaming = renaming?.name === group.name;
    const count = group.items.length;
    const errorId = `${idBase}-rename-error-${index}`;
    const renameError = isRenaming ? renaming.error : null;
    return (
      <li key={group.name}>
        <GroupRow>
          {isRenaming ? (
            <NameInput
              aria-label={`New name for ${group.name}`}
              aria-invalid={Boolean(renameError)}
              aria-describedby={renameError ? errorId : undefined}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={renaming.value}
              onChange={(event) =>
                setRenaming({
                  ...renaming,
                  value: event.target.value,
                  error: null,
                })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitRename();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setRenaming(null);
                }
              }}
            />
          ) : (
            <GroupName>{group.name}</GroupName>
          )}
          {isRenaming ? (
            <>
              <TextButton type="button" onClick={commitRename}>
                Rename
              </TextButton>
              <IconButton
                type="button"
                aria-label="Cancel renaming"
                onClick={() => setRenaming(null)}
              >
                <FaTimes aria-hidden="true" />
              </IconButton>
            </>
          ) : (
            <>
              <TextButton
                type="button"
                aria-label={`Draw in ${group.name}`}
                onClick={() => startDrawing(group)}
              >
                Draw
              </TextButton>
              <IconButton
                type="button"
                aria-label={`Rename ${group.name}`}
                title="Rename"
                onClick={() => {
                  setConfirmingDelete(null);
                  setRenaming({
                    name: group.name,
                    value: group.name,
                    error: null,
                  });
                }}
              >
                <FaPencilAlt aria-hidden="true" />
              </IconButton>
              <IconButton
                type="button"
                aria-label={`Delete ${group.name}`}
                title="Delete"
                onClick={() => requestDelete(group)}
              >
                <FaTrashAlt aria-hidden="true" />
              </IconButton>
            </>
          )}
        </GroupRow>
        {renameError && (
          <ErrorText id={errorId} role="alert">
            {renameError}
          </ErrorText>
        )}
        {confirmingDelete === group.name && (
          <Confirm role="alertdialog" aria-label={`Delete ${group.name}?`}>
            <span>
              Delete &quot;{group.name}&quot; and its {count} annotation
              {count === 1 ? "" : "s"}? The dashboard&apos;s Cancel still brings
              it back until you save.
            </span>
            <ButtonRow>
              {/* Focus moves here as the confirmation opens, so it is
                  announced and answerable from the keyboard. */}
              <DangerButton
                type="button"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                onClick={() => deleteGroup(group.name)}
              >
                Delete
              </DangerButton>
              <TextButton
                type="button"
                onClick={() => setConfirmingDelete(null)}
              >
                Keep
              </TextButton>
            </ButtonRow>
          </Confirm>
        )}
        <DefaultsToggle
          type="button"
          aria-expanded={defaultsOpen === group.name}
          aria-label={`${group.name} default styles`}
          onClick={() =>
            setDefaultsOpen(defaultsOpen === group.name ? null : group.name)
          }
        >
          {defaultsOpen === group.name ? (
            <FaChevronDown aria-hidden="true" />
          ) : (
            <FaChevronRight aria-hidden="true" />
          )}
          Default styles
        </DefaultsToggle>
        {defaultsOpen === group.name && renderDefaults(group)}
      </li>
    );
  };

  return (
    <ControlWrapper mapDivRef={mapDivRef}>
      <MapSizedControlContainer
        container={Container}
        expanded={expanded}
        aria-label="Annotation Control"
      >
        {expanded ? (
          <div ref={containerRef}>
            <b>Annotations</b>
            <CloseButton
              type="button"
              aria-label="Close Annotation Control"
              onClick={() => setExpanded(false)}
            >
              <FaTimes aria-hidden="true" />
            </CloseButton>
            {groups.length === 0 ? (
              <Help>
                This map has no annotations yet. Add a group, then draw lines,
                arrows and text on the map.
              </Help>
            ) : (
              <GroupList aria-label="Annotation groups">
                {groups.map(renderGroup)}
              </GroupList>
            )}
            <AddButton type="button" onClick={addGroup}>
              <FaPlus aria-hidden="true" />
              Add group
            </AddButton>
          </div>
        ) : (
          <ToggleButton
            type="button"
            aria-label="Show Annotation Control"
            title="Annotations"
            onClick={() => setExpanded(true)}
          >
            <FaPencilAlt aria-hidden="true" />
          </ToggleButton>
        )}
      </MapSizedControlContainer>
    </ControlWrapper>
  );
};

export const annotationControlPropType = PropTypes.shape({
  /** The map's groups as saved, before variable substitution. */
  groups: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      defaults: PropTypes.object.isRequired,
      items: PropTypes.array.isRequired,
    }),
  ).isRequired,
  /** Writes a new list of groups into the dashboard's unsaved edits. */
  onGroupsChange: PropTypes.func.isRequired,
  /** The open drawing session, or null. */
  session: PropTypes.shape({
    groupName: PropTypes.string.isRequired,
    layerName: PropTypes.string.isRequired,
    title: PropTypes.string,
    defaults: PropTypes.object,
    items: PropTypes.array,
    startItems: PropTypes.array,
  }),
  onSessionChange: PropTypes.func.isRequired,
});

AnnotationControl.propTypes = {
  visualizationRef: PropTypes.shape({ current: PropTypes.any }),
  /** The map div this control belongs to, for the map-relative height cap. */
  mapDivRef: PropTypes.shape({ current: PropTypes.any }),
  // See annotationControlPropType, which map/Map.js spreads into these.
  groups: PropTypes.array.isRequired,
  onGroupsChange: PropTypes.func.isRequired,
  session: PropTypes.object,
  onSessionChange: PropTypes.func.isRequired,
};

export default AnnotationControl;
