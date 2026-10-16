import { Map as OlMap, View } from "ol";
import moduleLoader, { withProxiedImages } from "components/map/ModuleLoader";

/* Dashboard maps, keyed by their map element, so a capture can find the
   OpenLayers map behind each map it is about to serialize. A WeakMap rather
   than a context: the capture runs outside React, and the DataViewer's preview
   map is never inside the grid being captured, so it cannot be confused with
   the dashboard map it previews. */
const captureMaps = new WeakMap();

/**
 * Make a map findable by a capture. getLayerConfig(olLayer) returns the live,
 * variable-substituted config the layer was built from. Returns the unregister.
 */
export function registerCaptureMap(element, map, getLayerConfig) {
  if (!element) return () => {};
  captureMaps.set(element, { map, getLayerConfig });
  return () => {
    if (captureMaps.get(element)?.map === map) captureMaps.delete(element);
  };
}

// How long one proxied re-render may take before the layer is reported instead.
export const LOCKED_LAYER_RENDER_TIMEOUT = 8000;

/* A canvas holding an image fetched without CORS permission is tainted: drawing
   it works, reading it throws. A WebGL canvas has no 2D context to probe, and
   WebGL never draws a cross-origin image it may not read, so it is never
   tainted. */
function isTainted(canvas) {
  if (!(canvas.width > 0 && canvas.height > 0)) return false;
  let context;
  try {
    context = canvas.getContext("2d");
  } catch {
    return false;
  }
  if (!context) return false;
  try {
    context.getImageData(0, 0, 1, 1);
    return false;
  } catch {
    return true;
  }
}

function layerCanvas(layer) {
  return layer.getRenderer?.()?.context?.canvas ?? null;
}

/**
 * Render one layer, alone, in an offscreen map that matches the live one, with
 * its image request routed through the proxy. Resolves to the layer's canvas, or
 * rejects on a load error or timeout. dispose() is always called by the caller.
 */
async function renderThroughProxy(liveMap, layerConfig, proxiedUrl, disposers) {
  const size = liveMap.getSize();
  const liveView = liveMap.getView();
  if (!size || !(size[0] > 0 && size[1] > 0)) {
    throw new Error("The map has no size");
  }

  // Offscreen, not display:none - OpenLayers does not render a map it cannot
  // measure.
  const container = document.createElement("div");
  Object.assign(container.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${size[0]}px`,
    height: `${size[1]}px`,
  });
  document.body.appendChild(container);

  const projection = liveView.getProjection().getCode();
  const offscreen = new OlMap({
    target: container,
    controls: [],
    interactions: [],
    view: new View({
      projection: liveView.getProjection(),
      center: liveView.getCenter(),
      resolution: liveView.getResolution(),
      rotation: liveView.getRotation(),
    }),
  });
  disposers.push(() => {
    offscreen.setTarget(undefined);
    container.remove();
  });

  const layer = await moduleLoader(
    withProxiedImages(layerConfig, proxiedUrl),
    projection,
    () => projection,
  );
  // Whatever the live layer was doing, the copy is drawn as configured.
  layer.setVisible(true);
  offscreen.addLayer(layer);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out")),
      LOCKED_LAYER_RENDER_TIMEOUT,
    );
    let failed = false;
    layer.getSource?.()?.on?.("imageloaderror", () => {
      failed = true;
    });
    offscreen.once("rendercomplete", () => {
      clearTimeout(timer);
      if (failed) reject(new Error("The image could not be loaded"));
      else resolve();
    });
    offscreen.renderSync();
  });

  const canvas = layerCanvas(layer);
  if (!canvas || isTainted(canvas)) {
    throw new Error("The re-rendered layer is not readable");
  }
  return canvas;
}

/* Stand an image of the re-rendered layer where the live canvas was, styled as
   the re-rendered canvas was so its transform matches its pixels. Opacity is
   already in the pixels: OpenLayers draws image layers with globalAlpha. */
async function swapIn(liveCanvas, renderedCanvas, session) {
  const image = document.createElement("img");
  image.width = renderedCanvas.width;
  image.height = renderedCanvas.height;
  image.style.cssText = renderedCanvas.style.cssText;
  image.src = renderedCanvas.toDataURL("image/png");
  try {
    await image.decode?.();
  } catch {
    // Serialized from the src either way.
  }
  liveCanvas.replaceWith(image);
  session.record(() => image.replaceWith(liveCanvas));
}

/**
 * For every registered map inside root, find the layer canvases the browser will
 * not let a capture read, and stand in an image of each fetched through the
 * proxy for the length of the capture session.
 *
 * Returns the map elements with a layer that could not be included: one that
 * failed to re-render, or a tainted canvas with no image source behind it (a
 * vector layer with a cross-origin point icon).
 */
export async function captureLockedMapLayers(root, session, proxiedUrl) {
  const incomplete = new Set();
  // By label rather than class: a plugin's mapConfig may replace the class.
  const elements = Array.from(root.querySelectorAll('[aria-label="Map Div"]'));
  const disposers = [];

  try {
    await Promise.all(
      elements.map(async (element) => {
        const entry = captureMaps.get(element);
        if (!entry) return;
        const { map, getLayerConfig } = entry;

        const layersByCanvas = new Map();
        for (const layer of map.getLayers().getArray()) {
          const canvas = layerCanvas(layer);
          if (canvas && layer.getVisible()) layersByCanvas.set(canvas, layer);
        }

        const tainted = Array.from(
          map.getViewport().querySelectorAll("canvas"),
        ).filter(isTainted);

        await Promise.all(
          tainted.map(async (canvas) => {
            const layer = layersByCanvas.get(canvas);
            const config = layer && getLayerConfig(layer);
            const proxiable =
              config && withProxiedImages(config, proxiedUrl) !== config;
            if (!proxiable) {
              incomplete.add(element);
              return;
            }
            try {
              const rendered = await renderThroughProxy(
                map,
                config,
                proxiedUrl,
                disposers,
              );
              await swapIn(canvas, rendered, session);
            } catch (error) {
              console.warn(
                `Capture: could not re-fetch map layer "${layer.get("name")}":`,
                error,
              );
              incomplete.add(element);
            }
          }),
        );
      }),
    );
  } finally {
    // The offscreen maps are done once their pixels are copied into the swapped
    // images; only the swaps themselves wait for the session to end.
    disposers.forEach((dispose) => dispose());
  }

  return Array.from(incomplete);
}
