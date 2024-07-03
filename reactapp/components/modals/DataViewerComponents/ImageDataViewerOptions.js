import DataInput from "components/inputs/DataInput";
import PropTypes from "prop-types";

function ImageDataViewerOptions({ imageSource, setImageSource }) {
  function onImageSourceChange(e) {
    setImageSource(e.currentTarget.value);
  }

  return (
    <div>
      <DataInput
        inputLabel="Image Source"
        inputValue={imageSource}
        onChange={onImageSourceChange}
      />
    </div>
  );
}

ImageDataViewerOptions.propTypes = {
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
  handleSubmit: PropTypes.func,
};

export default ImageDataViewerOptions;
