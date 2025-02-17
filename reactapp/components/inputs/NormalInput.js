import Form from "react-bootstrap/Form";

const NormalInput = ({ label, onChange, value, type }) => {
  return (
    <div>
      <Form.Label>
        <b>{label}</b>:
      </Form.Label>
      <Form.Control
        aria-label={label + " Input"}
        type={type}
        onChange={onChange}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault(); // prevents submitting form on enter
          }
        }}
        value={value}
      />
    </div>
  );
};

export default NormalInput;
