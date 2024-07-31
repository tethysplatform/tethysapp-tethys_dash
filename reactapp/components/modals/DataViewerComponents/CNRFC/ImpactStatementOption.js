import DataTable from "components/visualizations/DataTable";
import styled from "styled-components";
import Spinner from "react-bootstrap/Spinner";
import appAPI from "services/api/app";

const StyledSpinner = styled(Spinner)`
  margin: auto;
  display: block;
`;

const StyledH2 = styled.h2`
  text-align: center;
`;

function setImpactStatements(
  setUpdateCellMessage,
  selectedLocationOption,
  setViz,
  setVizMetadata
) {
  setViz(<StyledSpinner animation="border" variant="info" />);
  const itemData = {
    type: "ImpactStatement",
    metadata: {
      location: selectedLocationOption.current["value"],
    },
  };
  setVizMetadata(itemData);
  setUpdateCellMessage(
    "Cell updated to show RFC impact statements at " +
      selectedLocationOption.current["label"] +
      "."
  );
  appAPI.getPlotData(itemData).then((response) => {
    if (response.success === true) {
      setViz(
        <DataTable
          data={response.data}
          title={selectedLocationOption.current["value"] + " Impact Statements"}
        />
      );
    } else {
      setViz(<StyledH2>Failed to retrieve data</StyledH2>);
    }
  });
}

export default setImpactStatements;
