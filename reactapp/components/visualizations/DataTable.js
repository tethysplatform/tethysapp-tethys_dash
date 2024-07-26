import PropTypes from "prop-types";
import styled from "styled-components";
import { memo } from "react";
import Table from "react-bootstrap/Table";

const StyledDiv = styled.div`
  height: 100%;
  overflow-y: auto;
  text-align: center;
`;

const DataTable = ({ data, title }) => {
  if (data.length === 0) {
    return (
      <StyledDiv>
        <h2>No Data Available</h2>
      </StyledDiv>
    );
  }
  const tableKeys = Object.keys(data[0]);

  const TableHead = () => {
    const ths = [];
    for (let key of tableKeys) {
      ths.push(<th key={key}>{capitalizePhrase(key)}</th>);
    }
    return (
      <thead>
        <tr>{ths}</tr>
      </thead>
    );
  };

  const TableBody = () => {
    const trs = [];
    for (let i = 0; i < data.length; i++) {
      const tds = [];
      const dataPoint = data[i];
      for (let key of tableKeys) {
        tds.push(<th key={key}>{dataPoint[key]}</th>);
      }
      trs.push(<tr key={i}>{tds}</tr>);
    }
    return <tbody>{trs}</tbody>;
  };

  return (
    <StyledDiv>
      <h2>{title}</h2>
      <Table striped bordered hover>
        {TableHead()}
        {TableBody()}
      </Table>
    </StyledDiv>
  );
};

function capitalizePhrase(phrase) {
  const words = phrase.split(" ");

  for (let i = 0; i < words.length; i++) {
    words[i] = words[i][0].toUpperCase() + words[i].substr(1);
  }

  return words.join(" ");
}

DataTable.propTypes = {
  data: PropTypes.array,
};

export default memo(DataTable);
