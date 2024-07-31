import Image from "components/visualizations/Image";

function setImage(
  selectedVizTypeOption,
  setUpdateCellMessage,
  selectedLocationOption,
  setViz,
  setVizMetadata
) {
  let imageURL;
  if (selectedVizTypeOption["value"]["fullURL"] || null) {
    imageURL = selectedVizTypeOption["value"]["fullURL"];
    setUpdateCellMessage(
      "Cell updated to show " + selectedVizTypeOption["label"]
    );
  } else {
    imageURL =
      selectedVizTypeOption["value"]["baseURL"] +
      selectedLocationOption.current["value"] +
      selectedVizTypeOption["value"]["plotName"];
    setUpdateCellMessage(
      "Cell updated to show " +
        selectedVizTypeOption["label"] +
        " plot at " +
        selectedLocationOption.current["label"]
    );
  }
  setViz(<Image source={imageURL} />);
  const itemData = {
    type: "Image",
    metadata: {
      uri: imageURL,
    },
  };
  setVizMetadata(itemData);
}

export default setImage;
