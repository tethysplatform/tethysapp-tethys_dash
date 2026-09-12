/**
 * A stand-in map div that reports a fixed height.
 *
 * jsdom performs no layout, so `getBoundingClientRect` returns zeros for every
 * element. The override is an OWN property so it shadows any prototype-wide
 * `getBoundingClientRect` spy a suite has installed for the anchor rect -- which
 * is what lets the map div report a different rect than the control's anchor.
 */
export const makeMapDiv = (height) => {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    width: 300,
    height,
    bottom: height,
    right: 300,
    toJSON: () => ({}),
  });
  document.body.appendChild(element);
  return element;
};
