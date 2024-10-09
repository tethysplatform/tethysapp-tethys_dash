import Layer from 'ol/layer/WebGLTile.js';
import { useEffect } from 'react';
import { useMapContext } from '../../hooks/useMapContext';
import { useMap } from '../../hooks/useMap';

const WebGLTile = (props) => {
    const { map } = useMapContext();
    const { addLayer, removeLayer } = useMap(map);

    useEffect(() => {
        if (!map) return;
        const layer = new Layer({
            ...props
        });
        layer.set("name", props.name ?? "WebGLTile Layer");
        addLayer(layer);
        
        return () => {
            if (!map) return;
            removeLayer(layer);
        };
    }, [map]);

};

export default WebGLTile;

