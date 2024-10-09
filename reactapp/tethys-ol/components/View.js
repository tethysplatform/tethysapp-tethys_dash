import { useEffect} from 'react';

import { useMapContext } from '../hooks/useMapContext';
import { View as OlView } from 'ol';

const View = ({ ...props}) => {
  const {map} = useMapContext();

  useEffect(() => {
    if (!map) return;
    map.setView(
        new OlView({
            ...props
        })
    )

    return () => {
        if (!map) return;
        map.setView(null)
    };

  }, [props]);

};

export default View;