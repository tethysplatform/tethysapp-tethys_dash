import PropTypes from "prop-types";
import styled from "styled-components";
import { memo } from "react";
import Table from "react-bootstrap/Table";

const StyledDiv = styled.div`
  height: 100%;
  overflow-y: auto;
  text-align: center;
`;

const DataTable = ({ data, title, subtitle, visualizationRef }) => {
  if (data.length === 0) {
    return (
      <StyledDiv>
        <h2>No Data Available</h2>
      </StyledDiv>
    );
  }
  const tableKeys = Object.keys(data[0]);

  const TableHead = () => {
    return (
      <thead>
        <tr>
          {tableKeys.map((key) => (
            <th key={key}>{capitalizePhrase(key)}</th>
          ))}
        </tr>
      </thead>
    );
  };

  const TableBody = () => {
    return (
      <tbody>
        {data.map((data, index) => (
          <tr key={index}>
            {Object.keys(data).map((key) => (
              <th key={key}>{data[key]}</th>
            ))}
          </tr>
        ))}
      </tbody>
    );
  };

  return (
    <StyledDiv>
      <h2>{title}</h2>
      {subtitle && <h4>{subtitle}</h4>}
      <Table striped bordered hover ref={visualizationRef}>
        <TableHead />
        <TableBody />
      </Table>
    </StyledDiv>
  );
};

function capitalizePhrase(phrase) {
  let words = phrase.split(" ");
  words = words.filter((e) => e !== "");

  for (let i = 0; i < words.length; i++) {
    words[i] = words[i][0].toUpperCase() + words[i].substr(1);
  }

  return words.join(" ");
}

DataTable.propTypes = {
  data: PropTypes.array,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default memo(DataTable);
