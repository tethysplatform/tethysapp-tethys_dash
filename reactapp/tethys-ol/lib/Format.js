import * as olFormat from 'ol/format';

const Format = ({ is }) => {
  const FormatConstructor = olFormat[is];
  if (!FormatConstructor) {
    throw new Error(`Format type '${is}' not found in 'ol/format'.`);
  }
  return new FormatConstructor();
};

export default Format;