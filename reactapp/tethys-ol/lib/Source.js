import * as olSource from 'ol/source';

const Source = ({ is, ...sourceProps }) => {
  const SourceConstructor = olSource[is];
  if (!SourceConstructor) {
    throw new Error(`Source type '${is}' not found in 'ol/source'.`);
  }
  return new SourceConstructor(sourceProps);
};

export default Source;