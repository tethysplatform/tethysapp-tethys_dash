import { useEffect, useRef, useState } from "react";
// The observer react-grid-layout itself measures with; the browser's own
// ResizeObserver wherever there is one.
import ResizeObserver from "resize-observer-polyfill";

// What react-grid-layout's own WidthProvider starts from, until the grid has
// been measured.
const DEFAULT_WIDTH = 1280;

/**
 * react-grid-layout's WidthProvider, except that a width of 0 is ignored.
 *
 * The dashboard keeps every tab mounted and hides the inactive ones with
 * `display: none`, which measures 0 wide. WidthProvider lays a hidden tab's
 * tiles out at that width, so showing the tab again grew every tile back from
 * nothing over the grid's 200 ms transition, with each map and plot resizing
 * through every frame of it. A hidden tab keeps the width it last really had.
 */
export default function keepWidthWhenHidden(GridLayout) {
  const WithWidth = (props) => {
    const elementRef = useRef(null);
    const [width, setWidth] = useState(DEFAULT_WIDTH);

    useEffect(() => {
      const node = elementRef.current;
      if (!node) return undefined;
      const observer = new ResizeObserver((entries) => {
        const measured = entries[0].contentRect.width;
        if (measured > 0) setWidth(measured);
      });
      observer.observe(node);
      return () => observer.disconnect();
    }, []);

    return <GridLayout {...props} innerRef={elementRef} width={width} />;
  };
  return WithWidth;
}
