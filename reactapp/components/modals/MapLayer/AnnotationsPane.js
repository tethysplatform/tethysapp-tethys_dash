import PropTypes from "prop-types";
import { memo } from "react";
import Accordion from "react-bootstrap/Accordion";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
import AnnotationStyleControl, {
  FIELDS_BY_KIND,
  FIELD_LABELS,
} from "components/inputs/AnnotationStyleControl";
import {
  DEFAULT_ARROWHEAD_OPTIONS,
  normalizeAnnotations,
  resolveAnnotationDefaults,
} from "components/map/annotations";

const Section = styled.div`
  margin-bottom: 1.25rem;
`;

const SectionTitle = styled.h6`
  font-weight: bold;
  margin-bottom: 0.5rem;
`;

const Field = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
`;

const FieldLabel = styled(Form.Label)`
  font-weight: bold;
  margin-bottom: 0;
  min-width: 10rem;
`;

const Control = styled.div`
  flex: 0 1 auto;
  max-width: ${(props) => props.$width};
`;

const Help = styled.p`
  color: #6c757d;
  font-size: 0.875rem;
  margin: 0 0 0.75rem;
`;

const STYLE_SECTIONS = [
  {
    key: "line",
    title: "Line/Arrow Default Styles",
    help: "Used by every line and arrow in this layer unless it sets its own value on the map. Arrowheads apply to arrows; plain lines never draw them.",
  },
  {
    key: "text",
    title: "Text Default Styles",
    help: "Used by every text annotation in this layer unless it sets its own value on the map.",
  },
];

/**
 * The Annotations tab: the button that starts drawing on the map, and the
 * layer's default styles. Everything about one annotation -- its geometry,
 * text and own style -- is edited on the map.
 */
const AnnotationsPane = ({
  annotations,
  onChange,
  onEditOnMap,
  containerRef,
}) => {
  const { defaults, items } = normalizeAnnotations(annotations);
  const resolvedDefaults = resolveAnnotationDefaults(defaults);

  const setDefault = (field, value) => {
    const next = { ...defaults };
    if (value === undefined) {
      delete next[field];
    } else {
      next[field] = value;
    }
    onChange({ defaults: next, items });
  };

  return (
    <div data-testid="annotations-pane">
      <Section>
        <SectionTitle>Annotations</SectionTitle>
        <Help>
          Draw lines, arrows and text on the map. Each one stays pinned to the
          place you drew it as viewers pan and zoom. Select an annotation on the
          map to change its text or its own style.
        </Help>
        {items.length === 0 && (
          <Help>
            This layer has no annotations yet. Use Edit on map to draw some.
          </Help>
        )}
        <Button
          variant="primary"
          onClick={onEditOnMap}
          disabled={!onEditOnMap}
          aria-label="Edit annotations on map"
        >
          Edit on map
        </Button>
      </Section>

      <Accordion alwaysOpen>
        {STYLE_SECTIONS.map(({ key, title, help }) => (
          <Accordion.Item eventKey={key} key={key}>
            <Accordion.Header>
              <span style={{ flex: 1, fontWeight: 500 }}>{title}</span>
            </Accordion.Header>
            <Accordion.Body role="group" aria-label={title}>
              <Help>{help}</Help>
              {FIELDS_BY_KIND[key].map((field) => (
                <Field key={field}>
                  <FieldLabel>{FIELD_LABELS[field]}</FieldLabel>
                  <Control $width={field === "arrowheads" ? "10rem" : "8rem"}>
                    <AnnotationStyleControl
                      field={field}
                      value={resolvedDefaults[field]}
                      storedValue={defaults[field]}
                      onChange={(value) => setDefault(field, value)}
                      ariaPrefix="Default "
                      containerRef={containerRef}
                      arrowheadOptions={DEFAULT_ARROWHEAD_OPTIONS}
                    />
                  </Control>
                </Field>
              ))}
            </Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  );
};

AnnotationsPane.propTypes = {
  annotations: PropTypes.shape({
    defaults: PropTypes.object,
    items: PropTypes.array,
  }),
  onChange: PropTypes.func.isRequired,
  // Starts the on-map editing session; absent until the editor can host one.
  onEditOnMap: PropTypes.func,
  containerRef: PropTypes.object,
};

export default memo(AnnotationsPane);
