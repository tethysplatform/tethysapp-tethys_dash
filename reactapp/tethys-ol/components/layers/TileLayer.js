import {Tile as Layer} from "ol/layer";
import { useEffect } from 'react';
import { useMapContext } from '../../hooks/useMapContext';
import { useMap } from '../../hooks/useMap';



const TileLayer = (props) => {

    const {map} = useMapContext();
    const { addLayer, removeLayer } = useMap(map);
    
    useEffect(() => {
        if (!map) return;
        const layer = new Layer({
            ...props
        });
        layer.set("name", props.name ?? "Tile Layer");
        addLayer(layer);
        
        return () => {
            if (!map) return;
            removeLayer(layer);
        };
    }, [map]);

};

export default TileLayer;

