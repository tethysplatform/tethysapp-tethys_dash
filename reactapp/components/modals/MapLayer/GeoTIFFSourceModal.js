import PropTypes from "prop-types";
import { useState, useEffect, useRef } from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 20vh;
`;

const FieldGroup = styled(Form.Group)`
  padding-bottom: 1rem;
`;

const emptyState = () => ({
  url: "",
  bands: "",
  min: "",
  max: "",
  nodata: "",
  projection: "",
  overviews: "",
});

const seedFromInitial = (initialValue) => {
  if (!initialValue) return emptyState();
  const overviewsArr = Array.isArray(initialValue.overviews)
    ? initialValue.overviews
    : [];
  return {
    url: initialValue.url ?? "",
    bands: initialValue.bands ?? "",
    min: initialValue.min ?? "",
    max: initialValue.max ?? "",
    nodata: initialValue.nodata ?? "",
    projection: initialValue.projection ?? "",
    overviews: overviewsArr.join("\n"),
  };
};

const GeoTIFFSourceModal = ({
  show,
  onHide,
  onSave,
  initialValue,
  returnFocusRef,
}) => {
  const [fields, setFields] = useState(() => seedFromInitial(initialValue));
  const urlInputRef = useRef(null);

  useEffect(() => {
    if (show) {
      setFields(seedFromInitial(initialValue));
    }
  }, [show, initialValue]);

  useEffect(() => {
    if (!show) return undefined;
    const rafId = requestAnimationFrame(() => {
      if (urlInputRef.current) {
        urlInputRef.current.focus();
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [show]);

  const updateField = (key) => (e) => {
    const val = e.target.value;
    setFields((prev) => ({ ...prev, [key]: val }));
  };

  const saveDisabled = fields.url.trim() === "";

  const handleSave = () => {
    const overviewsArray = fields.overviews
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");

    const payload = {
      url: fields.url,
      bands: fields.bands,
      min: fields.min,
      max: fields.max,
      nodata: fields.nodata,
      projection: fields.projection,
      overviews: overviewsArray,
    };

    onSave(payload);
    onHide();
  };

  const handleCancel = () => {
    onHide();
  };

  const handleExited = () => {
    if (returnFocusRef && returnFocusRef.current) {
      returnFocusRef.current.focus();
    }
  };

  const title =
    initialValue == null ? "Add GeoTIFF Source" : "Edit GeoTIFF Source";

  return (
    <Modal
      show={show}
      onHide={handleCancel}
      onExited={handleExited}
      centered
      aria-labelledby="geotiff-source-modal-title"
    >
      <Modal.Header closeButton>
        <Modal.Title id="geotiff-source-modal-title">{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <FieldGroup controlId="geotiff-source-url">
          <Form.Label>
            <b>URL</b>:
          </Form.Label>
          <Form.Control
            ref={urlInputRef}
            type="text"
            value={fields.url}
            onChange={updateField("url")}
            placeholder="https://example.com/file.tif"
            required
            aria-label="URL Input"
          />
        </FieldGroup>

        <FieldGroup controlId="geotiff-source-bands">
          <Form.Label>
            <b>Bands</b>:
          </Form.Label>
          <NormalInput
            ariaLabel="Bands Input"
            type="text"
            value={fields.bands}
            placeholder="1, 2, 3"
            onChange={updateField("bands")}
          />
        </FieldGroup>

        <FieldGroup controlId="geotiff-source-min">
          <Form.Label>
            <b>Min</b>:
          </Form.Label>
          <NormalInput
            ariaLabel="Min Input"
            type="number"
            value={fields.min}
            onChange={updateField("min")}
            allowEmpty
          />
        </FieldGroup>

        <FieldGroup controlId="geotiff-source-max">
          <Form.Label>
            <b>Max</b>:
          </Form.Label>
          <NormalInput
            ariaLabel="Max Input"
            type="number"
            value={fields.max}
            onChange={updateField("max")}
            allowEmpty
          />
        </FieldGroup>

        <FieldGroup controlId="geotiff-source-nodata">
          <Form.Label>
            <b>Nodata</b>:
          </Form.Label>
          <NormalInput
            ariaLabel="Nodata Input"
            type="number"
            value={fields.nodata}
            onChange={updateField("nodata")}
            allowEmpty
          />
        </FieldGroup>

        <FieldGroup controlId="geotiff-source-projection">
          <Form.Label>
            <b>Projection</b>:
          </Form.Label>
          <NormalInput
            ariaLabel="Projection Input"
            type="text"
            value={fields.projection}
            placeholder="EPSG:4326"
            onChange={updateField("projection")}
          />
        </FieldGroup>

        <FieldGroup>
          <Form.Label htmlFor="geotiff-source-overviews">
            <b>Overviews</b>:
          </Form.Label>
          <StyledTextInput
            id="geotiff-source-overviews"
            aria-label="Overviews Input"
            value={fields.overviews}
            onChange={updateField("overviews")}
            placeholder={"One overview URL per line"}
          />
        </FieldGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={handleCancel}
          aria-label="Cancel GeoTIFF Source Button"
        >
          Cancel
        </Button>
        <Button
          variant="success"
          onClick={handleSave}
          disabled={saveDisabled}
          aria-label="Save GeoTIFF Source Button"
        >
          Save
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

GeoTIFFSourceModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialValue: PropTypes.shape({
    url: PropTypes.string,
    bands: PropTypes.string,
    min: PropTypes.string,
    max: PropTypes.string,
    nodata: PropTypes.string,
    projection: PropTypes.string,
    overviews: PropTypes.arrayOf(PropTypes.string),
  }),
  returnFocusRef: PropTypes.shape({
    current: PropTypes.any,
  }),
};

export default GeoTIFFSourceModal;
