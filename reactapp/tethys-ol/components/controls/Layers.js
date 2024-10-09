import { LayersControl } from "./LayersControl";
import { LayersControlProvider } from "./LayersProvider";


const Layers = ({ children }) => {

    return (
        <LayersControlProvider>
            <LayersControl>
                {children}
            </LayersControl>
        </LayersControlProvider>
    );
}


export { Layers }