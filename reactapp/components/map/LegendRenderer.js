import { useEffect, useState, memo } from "react";
import PropTypes from "prop-types";
import { RiRectangleFill } from "react-icons/ri";
import { IoAnalyticsOutline } from "react-icons/io5";
import {
  BsFillTriangleFill,
  BsFillSquareFill,
  BsFillCircleFill,
} from "react-icons/bs";
import { legendPropType } from "components/map/utilities";
import styled from "styled-components";

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
  upTriangle: BsFillTriangleFill,
  rightTriangle: RightTriangle,
  downTriangle: DownTriangle,
  leftTriangle: LeftTriangle,
  rectangle: RiRectangleFill,
  line: IoAnalyticsOutline,
};

export const LegendSymbol = ({ symbol, color, ...rest }) => {
  const isValidSymbol = symbol in legendSymbols;
  const SymbolComponent = isValidSymbol
    ? legendSymbols[symbol]
    : BsFillSquareFill;
  const label = `${color}-${isValidSymbol ? symbol : "square"}`;

  return <SymbolComponent aria-label={label} color={color} {...rest} />;
};

const LegendWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const LegendTitle = styled.h3`
  margin-bottom: 0.5rem;
`;

const LegendList = styled.ul`
  list-style: none;
  padding-left: 0;
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
    width: 85% !important;
    border: 1px solid #ccc;
    margin-bottom: 6px;
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
            })
        )
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
              selectedIds.includes(layer.layerId)
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

  // 🟢 Custom legend
  if (legend.items) {
    return (
      <LegendWrapper>
        {legend.title && <LegendTitle>{legend.title}</LegendTitle>}
        <LegendList>
          {legend.items.map((item, index) => (
            <LegendItem key={index}>
              <LegendSymbol symbol={item.symbol} color={item.color} />
              <span>{item.label}</span>
            </LegendItem>
          ))}
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
  symbol: PropTypes.string, // legend item symbol
};

LegendRenderer.propTypes = {
  legend: legendPropType,
};

export default memo(LegendRenderer);
