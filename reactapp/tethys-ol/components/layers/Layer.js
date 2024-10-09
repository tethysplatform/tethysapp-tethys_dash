import React from "react";


/**
 * @desc the dynamic Layer component is used to render various Layer components dynamically, some references:https://dev.to/ayo_tech/how-to-use-components-dynamically-in-react-2gmk
 * @params props: {
 *    useDefaultPath: this indicates that the component to be used is in the components folder if set to true else you would have to pass in a different component
 *    is: if `useDefaultPath` is true, you pass in the name of the component file or the path to the component in the component folder eg: NewComponent or BaseUI/NewComponent
 *    ...rest: the props to be passed into the new component
 * }
 */
const Layer = ({ is, useDefaultPath = true, ...layerProps }) => {
  return React.createElement(
    useDefaultPath ? require(`./${is}.js`).default : is,
    {
      ...layerProps,
    }
  );
};

export default Layer;