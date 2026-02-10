import { useEffect, useState, memo } from "react";
import PropTypes from "prop-types";
import { RiRectangleFill, RiAddFill } from "react-icons/ri";
import {
  BsFillTriangleFill,
  BsFillSquareFill,
  BsFillCircleFill,
  BsFillStarFill,
  BsDiamondFill,
} from "react-icons/bs";
import { legendPropType } from "components/map/utilities";
import styled from "styled-components";
import { defaultFill, defaultStroke } from "components/inputs/RuleEditor.js";

const RotatedAdd = styled(RiAddFill)`
  transform: rotate(45deg);
`;

const RightTriangle = styled(BsFillTriangleFill)`
  transform: rotate(90deg);
`;

const DownTriangle = styled(BsFillTriangleFill)`
  transform: rotate(180deg);
`;

const LeftTriangle = styled(BsFillTriangleFill)`
  transform: rotate(270deg);
`;

export const legendSymbols = {
  square: BsFillSquareFill,
  circle: BsFillCircleFill,
  triangle: BsFillTriangleFill,
  rightTriangle: RightTriangle,
  downTriangle: DownTriangle,
  leftTriangle: LeftTriangle,
  rectangle: RiRectangleFill,
  star: BsFillStarFill,
  diamond: BsDiamondFill,
  cross: RiAddFill,
  x: RotatedAdd,
};

const LegendWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const LegendTitle = styled.span`
  margin-top: 0.5rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const LegendList = styled.ul`
  list-style: none;
  padding-left: 1.5em;
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
`;

const LegendItem = styled.li`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const LegendImage = styled.img`
  && {
    width: 56.67% !important; /* 2/3 of 85% */
    border: 1px solid #ccc;
    margin-bottom: 4px; /* scale margin as well */
  }
`;

const LayerBlock = styled.div`
  margin-bottom: 1rem;
  text-align: center;
  width: 100%;
`;

const LayerTitle = styled.strong`
  display: block;
  margin-bottom: 0.25rem;
`;

const LoaderMessage = styled.div`
  font-style: italic;
`;

const ErrorMessage = styled.div`
  color: red;
`;

const parseLayerFilter = (raw, allLayerIds) => {
  if (typeof raw === "number") return [raw];
  if (typeof raw !== "string") return [];

  // If raw contains ":", assume it's in mode:list format
  if (raw.includes(":")) {
    const [mode, list] = raw.split(":");
    const ids = list
      .split(",")
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));

    switch (mode.trim()) {
      case "show":
        return ids;
      case "hide":
        return allLayerIds.filter((id) => !ids.includes(id));
      case "include":
        return Array.from(new Set([...ids, ...allLayerIds]));
      case "exclude":
        return allLayerIds.filter((id) => !ids.includes(id));
      default:
        return [];
    }
  }

  // Fallback: assume it's a raw comma-delimited list
  return raw
    .split(",")
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => !isNaN(id));
};

// LegendSymbol supports SVG hatching for polygons
export const LegendSymbol = ({
  symbol,
  color,
  stroke,
  polygonFillType,
  hatchSpacing = 8,
  hatchDirection = "diagonal",
  dotSpacing = 8,
  dotRadius = 2,
  strokeDash,
  strokeWidth = 4,
  ...rest
}) => {
  const isPolygonHatch = symbol === "polygon" && polygonFillType === "hatch";
  const isPolygonDot = symbol === "polygon" && polygonFillType === "dot";
  symbol = symbol === "polygon" ? "square" : symbol;
  const isLineString = symbol === "linestring";
  const effectiveDotSpacing = isNaN(Number(dotSpacing))
    ? 8
    : Number(dotSpacing);
  const effectiveDotRadius = isNaN(Number(dotRadius)) ? 2 : Number(dotRadius);
  if (isPolygonHatch) {
    // SVG with hatch pattern supporting direction
    let patternContent = null;
    if (hatchDirection === "horizontal") {
      patternContent = (
        <line
          x1="0"
          y1="0"
          x2={hatchSpacing}
          y2="0"
          stroke={color}
          strokeWidth="1.33"
        />
      );
    } else if (hatchDirection === "vertical") {
      patternContent = (
        <line
          x1="0"
          y1="0"
          x2="0"
          y2={hatchSpacing}
          stroke={color}
          strokeWidth="1.33"
        />
      );
    } else if (hatchDirection === "cross") {
      patternContent = (
        <>
          <line
            x1="0"
            y1="0"
            x2={hatchSpacing}
            y2="0"
            stroke={color}
            strokeWidth="1.33"
          />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={hatchSpacing}
            stroke={color}
            strokeWidth="1.33"
          />
        </>
      );
    } else {
      // diagonal (default)
      patternContent = (
        <line
          x1="0"
          y1="0"
          x2="0"
          y2={hatchSpacing}
          stroke={color}
          strokeWidth="1.33"
        />
      );
    }
    let patternTransform = undefined;
    if (hatchDirection === "diagonal") patternTransform = "rotate(45)";
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        aria-label="polygon-hatch"
        style={{
          border: `1px solid ${stroke || "#222"}`,
          borderRadius: 2,
          background: "none",
        }}
        {...rest}
      >
        <defs>
          <pattern
            id="hatch"
            width={hatchSpacing}
            height={hatchSpacing}
            patternTransform={patternTransform}
            patternUnits="userSpaceOnUse"
          >
            {patternContent}
          </pattern>
        </defs>
        <rect
          x="2"
          y="2"
          width="13.33"
          height="13.33"
          fill={`url(#hatch)`}
          stroke={stroke || "#222"}
          strokeWidth="1.33"
          rx="1.33"
        />
      </svg>
    );
  }
  if (isPolygonDot) {
    // SVG with dot pattern
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        aria-label="polygon-dot"
        style={{
          border: `1px solid ${stroke || "#222"}`,
          borderRadius: 2,
          background: "none",
        }}
        {...rest}
      >
        <defs>
          <pattern
            id="dot"
            width={effectiveDotSpacing}
            height={effectiveDotSpacing}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={effectiveDotSpacing / 2}
              cy={effectiveDotSpacing / 2}
              r={effectiveDotRadius * (2 / 3)}
              fill={color}
            />
          </pattern>
        </defs>
        <rect
          x="2"
          y="2"
          width="13.33"
          height="13.33"
          fill={`url(#dot)`}
          stroke={stroke || "#222"}
          strokeWidth="1.33"
          rx="1.33"
        />
      </svg>
    );
  }
  if (isLineString) {
    // SVG for linestring with strokeDash
    let dashArray = undefined;
    if (strokeDash) {
      dashArray = strokeDash
        .split(",")
        .map((v) => parseFloat(v.trim()))
        .filter((v) => !isNaN(v))
        .join(" ");
    }
    return (
      <svg
        width="21.33"
        height="8"
        viewBox="0 0 32 12"
        aria-label="linestring"
        style={{ display: "block" }}
        {...rest}
      >
        <line
          x1="2"
          y1="6"
          x2="20"
          y2="6"
          stroke={stroke || color}
          strokeWidth={strokeWidth * (2 / 3)}
          strokeDasharray={dashArray}
          strokeLinecap="round"
        />
      </svg>
    );
  }
  const isValidSymbol = symbol in legendSymbols;
  const SymbolComponent = isValidSymbol
    ? legendSymbols[symbol]
    : BsFillCircleFill;
  const label = `${color}-${isValidSymbol ? symbol : "circle"}`;
  return (
    <SymbolComponent
      aria-label={label}
      color={color}
      size={16}
      style={stroke ? { stroke: stroke, strokeWidth: 1.33 } : {}}
      {...rest}
    />
  );
};

function LegendRenderer({ legend }) {
  const [wmsImages, setWmsImages] = useState([]);
  const [esriItems, setEsriItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const isWms = legend?.sourceType === "WMS";
  const isEsri =
    legend?.sourceType === "ESRI Image and Map Service" ||
    legend?.sourceType === "ESRI Feature Service";

  // 🔵 Handle WMS
  useEffect(() => {
    if (isWms) {
      setIsLoading(true);
      setError(null);
      const layerNames = legend.layers.split(",").map((l) => l.trim());

      const urls = layerNames.map((layerName) => {
        const url = new URL(legend.url);
        url.searchParams.set("SERVICE", "WMS");
        url.searchParams.set("REQUEST", "GetLegendGraphic");
        url.searchParams.set("VERSION", "1.3.0");
        url.searchParams.set("FORMAT", "image/png");
        url.searchParams.set("LAYER", layerName);
        return { name: layerName, url: url.toString() };
      });

      Promise.all(
        urls.map(
          (entry) =>
            new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(entry);
              img.onerror = reject;
              img.src = entry.url;
            }),
        ),
      )
        .then((entries) => setWmsImages(entries))
        .catch((err) => {
          console.error("WMS legend error:", err);
          setError("Failed to load WMS legend.");
        })
        .finally(() => setIsLoading(false));
    }
    // eslint-disable-next-line
  }, [legend]);

  // 🔴 Handle ESRI
  useEffect(() => {
    if (isEsri) {
      setIsLoading(true);
      setError(null);
      if (!legend.url) {
        setError("No URL provided for ESRI legend.");
        setIsLoading(false);
        return;
      }

      const normalizedUrl = legend.url.replace(/FeatureServer/i, "MapServer");
      const legendUrl = `${normalizedUrl.replace(/\/+$/, "")}/legend?f=json`;

      (async () => {
        try {
          const response = await fetch(legendUrl);
          if (!response.ok) throw new Error("Network response was not ok");
          const data = await response.json();

          if (legend.layers != null) {
            const allLayerIds = data.layers.map((l) => l.layerId);
            const selectedIds = parseLayerFilter(legend.layers, allLayerIds);
            const filtered = data.layers.filter((layer) =>
              selectedIds.includes(layer.layerId),
            );

            setEsriItems(filtered);
          } else {
            setEsriItems(data.layers);
          }
        } catch (err) {
          console.error("ESRI legend fetch failed:", err);
          setError("Failed to load ESRI legend.");
        } finally {
          setIsLoading(false);
        }
      })();
    }
    // eslint-disable-next-line
  }, [legend]);

  if (!legend) return null;

  // 🟢 Custom legend (array of items)
  if (legend.items) {
    // If only one item, show symbol next to title, no label
    if (legend.items.length === 1) {
      const item = legend.items[0];
      return (
        <LegendWrapper>
          <LegendTitle>
            <LegendSymbol
              symbol={item.symbol}
              color={item.color}
              stroke={item.stroke}
              style={{ marginRight: 4 }}
            />
            {legend.title}
          </LegendTitle>
        </LegendWrapper>
      );
    }
    // Otherwise, normal list
    return (
      <LegendWrapper>
        {legend.title && <LegendTitle>{legend.title}</LegendTitle>}
        <LegendList>
          {legend.items.map((item, index) => (
            <LegendItem key={index}>
              <LegendSymbol
                symbol={item.symbol}
                color={item.color}
                stroke={item.stroke}
              />
              <span>{item.label}</span>
            </LegendItem>
          ))}
        </LegendList>
      </LegendWrapper>
    );
  }

  // 🟡 styleJSON legend (default + rules)
  if (legend.styleJSON) {
    const { default: defaultStyles = {}, rules = [] } = legend.styleJSON;
    // Helper to get a color or fallback
    const getColor = (obj, key, fallback) => (obj && obj[key]) || fallback;
    // Helper to get a symbol for legend based on geometry
    const getSymbol = (obj, geom) => {
      if (geom === "polygon") return "polygon";
      if (geom === "linestring") return "linestring";
      return obj?.shape || "circle";
    };

    // Compose legend items: default for each geometry, then rules
    const items = [];
    // Default styles
    for (const geom of ["point", "linestring", "polygon"]) {
      if (defaultStyles[geom]) {
        const shape = getSymbol(defaultStyles[geom], geom);
        const iconUrl = defaultStyles[geom].iconUrl;
        const fillColor = getColor(defaultStyles[geom], "fill", defaultFill);
        const strokeColor = getColor(
          defaultStyles[geom],
          "stroke",
          defaultStroke,
        );
        const polygonFillType = defaultStyles[geom].polygonFillType;
        const hatchSpacing = defaultStyles[geom].hatchSpacing;
        const strokeDash = defaultStyles[geom].strokeDash;
        const strokeWidth = defaultStyles[geom].strokeWidth;
        const hatchDirection = defaultStyles[geom].hatchDirection;
        const dotSpacing = defaultStyles[geom].dotSpacing;
        const dotRadius = defaultStyles[geom].dotRadius;
        items.push({
          label: geom, // temp, will adjust below
          symbol: shape,
          color: fillColor,
          stroke: strokeColor,
          iconUrl: shape === "icon" && iconUrl ? iconUrl : undefined,
          polygonFillType,
          hatchSpacing,
          hatchDirection,
          dotSpacing,
          dotRadius,
          strokeDash,
          strokeWidth,
        });
      }
    }
    // Rules (merge with default for geometry type)
    for (const rule of rules) {
      const geom = rule.geometryType || "point";
      const base = defaultStyles[geom] || {};
      const merged = { ...base, ...rule };
      const shape = getSymbol(merged, geom);
      const iconUrl = merged.iconUrl;
      const fillColor = getColor(merged, "fill", defaultFill);
      const strokeColor = getColor(merged, "stroke", defaultStroke);
      const polygonFillType = merged.polygonFillType;
      const hatchSpacing = merged.hatchSpacing;
      const strokeDash = merged.strokeDash;
      const strokeWidth = merged.strokeWidth;
      let label = rule.name
        ? rule.name
        : rule.conditionField && rule.conditionType && rule.conditionValue
          ? `${geom.charAt(0).toUpperCase() + geom.slice(1)}: ${rule.conditionField} ${rule.conditionType} ${rule.conditionValue}`
          : `${geom.charAt(0).toUpperCase() + geom.slice(1)} (Rule)`;
      const hatchDirection = merged.hatchDirection;
      const dotSpacing = merged.dotSpacing;
      const dotRadius = merged.dotRadius;
      items.push({
        label,
        symbol: shape,
        color: fillColor,
        stroke: strokeColor,
        iconUrl: shape === "icon" && iconUrl ? iconUrl : undefined,
        polygonFillType,
        hatchSpacing,
        hatchDirection,
        dotSpacing,
        dotRadius,
        strokeDash,
        strokeWidth,
      });
    }

    // If only one style (single default or single rule), show symbol next to title, no label
    if (items.length === 1) {
      const item = items[0];
      return (
        <LegendWrapper>
          <LegendTitle>
            {item.iconUrl ? (
              <img
                aria-label={`icon-${item.label}`}
                src={item.iconUrl}
                alt="icon"
                style={{ width: 16, height: 16, marginRight: 4 }}
              />
            ) : (
              <LegendSymbol
                symbol={item.symbol}
                color={item.color}
                stroke={item.stroke}
                polygonFillType={item.polygonFillType}
                hatchSpacing={item.hatchSpacing}
                hatchDirection={item.hatchDirection}
                dotSpacing={item.dotSpacing}
                dotRadius={item.dotRadius}
                strokeDash={item.strokeDash}
                strokeWidth={item.strokeWidth}
                style={{ marginRight: 4 }}
              />
            )}
            {legend.title}
          </LegendTitle>
        </LegendWrapper>
      );
    }

    // If multiple styles but only a single default, use label 'Default' for that item
    const defaultCount = Object.keys(defaultStyles).filter(
      (g) => defaultStyles[g],
    ).length;
    const hasRules = rules.length > 0;
    let showDefaultLabel = false;
    if (items.length > 1 && defaultCount === 1 && hasRules) {
      showDefaultLabel = true;
    }

    return (
      <LegendWrapper>
        {legend.title && <LegendTitle>{legend.title}</LegendTitle>}
        <LegendList>
          {items.map((item, idx) => {
            // If only one default and multiple styles, label as 'Default'
            let label = item.label;
            if (showDefaultLabel && idx === 0) label = "Default";
            return (
              <LegendItem key={idx}>
                {item.iconUrl ? (
                  <img
                    aria-label={`icon-${label}`}
                    src={item.iconUrl}
                    alt="icon"
                    style={{ width: 16, height: 16, marginRight: 4 }}
                  />
                ) : (
                  <LegendSymbol
                    symbol={item.symbol}
                    color={item.color}
                    stroke={item.stroke}
                    polygonFillType={item.polygonFillType}
                    hatchSpacing={item.hatchSpacing}
                    hatchDirection={item.hatchDirection}
                    dotSpacing={item.dotSpacing}
                    dotRadius={item.dotRadius}
                    strokeDash={item.strokeDash}
                    strokeWidth={item.strokeWidth}
                  />
                )}
                <span>{label}</span>
              </LegendItem>
            );
          })}
        </LegendList>
      </LegendWrapper>
    );
  }

  if (isLoading) {
    return <LoaderMessage>Loading legend...</LoaderMessage>;
  }

  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }

  if (wmsImages.length > 0) {
    return (
      <LegendWrapper>
        {wmsImages.map(({ name, url }) => (
          <LayerBlock key={name}>
            <LayerTitle>{name}</LayerTitle>
            <LegendImage src={url} alt={`Legend for ${name}`} />
          </LayerBlock>
        ))}
      </LegendWrapper>
    );
  }

  if (esriItems.length > 0) {
    return (
      <LegendWrapper>
        {esriItems.map((layer) => (
          <LayerBlock key={layer.layerId}>
            {layer.layerName && <LayerTitle>{layer.layerName}</LayerTitle>}
            <LegendList>
              {layer.legend.map((item, index) => (
                <LegendItem key={index}>
                  <img
                    src={`data:${item.contentType};base64,${item.imageData}`}
                    alt={item.label}
                    width={item.width}
                    height={item.height}
                  />
                  <span>{item.label}</span>
                </LegendItem>
              ))}
            </LegendList>
          </LayerBlock>
        ))}
      </LegendWrapper>
    );
  }

  return null;
}

LegendSymbol.propTypes = {
  color: PropTypes.string, // legend item color
  symbol: PropTypes.string, // legend item
  stroke: PropTypes.string, // stroke color
  polygonFillType: PropTypes.string, // "solid", "hatch", "dot" for polygons
  hatchSpacing: PropTypes.number, // spacing for hatch pattern
  hatchDirection: PropTypes.string, // direction for hatch pattern
  dotSpacing: PropTypes.number, // spacing for dot pattern
  dotRadius: PropTypes.number, // radius for dot pattern
  strokeDash: PropTypes.string, // stroke dash array for linestrings
  strokeWidth: PropTypes.number, // stroke width for linestrings
};

LegendRenderer.propTypes = {
  legend: legendPropType,
};

export default memo(LegendRenderer);
