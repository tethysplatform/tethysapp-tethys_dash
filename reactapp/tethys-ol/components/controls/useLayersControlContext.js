import { useContext} from 'react';
import LayersControlContext from './LayersControlContext';


export const useLayersControlContext = () => {
    return useContext(LayersControlContext)
}