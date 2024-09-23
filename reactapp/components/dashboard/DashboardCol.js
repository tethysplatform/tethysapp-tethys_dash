import PropTypes from "prop-types";
import Col from "react-bootstrap/Col";
import DashboardItem from "components/dashboard/DashboardItem";
import styled from "styled-components";
import { createContext, useContext, useState, useEffect } from "react";

const StyledDashboardCol = styled(Col)`
  border: black solid 1px;
`;
const ColInfoContext = createContext();

function DashboardCol({ colNumber, colData }) {
  const colID = colData["id"];
  const colWidth = colData["width"];
  const colDataSource = colData["source"];
  const colDataArgs = colData["args"];
  const [width, setWidth] = useState(colWidth);

  useEffect(() => {
    setWidth(colWidth);
  }, [colWidth]);

  return (
    <StyledDashboardCol className={"justify-content-center h-100 col-" + width}>
      <ColInfoContext.Provider value={[colNumber, colID, width, setWidth]}>
        <DashboardItem
          source={colDataSource}
          args={colDataArgs}
        ></DashboardItem>
      </ColInfoContext.Provider>
    </StyledDashboardCol>
  );
}

DashboardCol.propTypes = {
  colNumber: PropTypes.number,
  colData: PropTypes.shape({
    id: PropTypes.number,
    width: PropTypes.number,
    type: PropTypes.string,
    metadata: PropTypes.object,
  }),
};

export default DashboardCol;

export const useColInfoContext = () => {
  return useContext(ColInfoContext);
};
