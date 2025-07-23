import requests
import xmltodict


class LayerConfigurationBuilder:
    """
    A builder class for creating structured layer configuration dictionaries for map visualizations.

    Attributes:
        name (str): The name of the overall layer for the map.
        config (dict): The configuration being built.
    """

    def __init__(self, name, layer_source):
        """
        A builder class for constructing standardized map layer configurations
        for use in map visualization tools.

        Args:
            name (str): The name of the layer.
            layer_source (str): The data source type for the layer. Must be one of:
                - 'ESRI Image and Map Service'
                - 'ESRI Feature Service'
                - 'WMS'
                - 'Image Tile'
                - 'GeoJSON'
                - 'Vector Tile'

        Raises:
            ValueError: If layer_source is not one of the supported options.
        """
        self.name = name

        valid_sources = {
            "Vector Tile": "VectorTileLayer",
            "Image Tile": "TileLayer",
            "WMS": "ImageLayer",
            "ESRI Image and Map Service": "ImageLayer",
            "ESRI Feature Service": "VectorLayer",
            "GeoJSON": "VectorLayer",
        }

        if layer_source not in valid_sources:
            raise ValueError(
                f"Invalid layer_source '{layer_source}'. Must be one of: "
                + ", ".join(valid_sources.keys())
            )

        layer_type = valid_sources[layer_source]

        self.layer_source = layer_source
        self.config = {
            "configuration": {
                "type": layer_type,
                "props": {"name": name, "source": {"type": layer_source, "props": {}}},
            },
            "attributeAliases": {},
            "attributeVariables": {},
            "omittedPopupAttributes": {},
        }

    def set_geojson(self, geojson: dict):
        """
        Attach a validated GeoJSON dictionary to the layer source.

        Args:
            geojson (dict): A valid GeoJSON FeatureCollection or Feature object.

        Raises:
            ValueError: If the geojson is not valid.

        Returns:
            LayerConfigurationBuilder: self (for chaining)
        """
        validate_geojson(geojson)

        self.config["configuration"]["props"]["source"]["geojson"] = geojson
        return self

    def set_opacity(self, opacity: float):
        """
        Set the opacity of the layer.

        Args:
            opacity (float): A number between 0.0 (fully transparent) and 1.0 (fully opaque).

        Raises:
            ValueError: If opacity is not between 0 and 1.

        Returns:
            LayerConfigurationBuilder: self (for chaining)
        """
        if not (0.0 <= opacity <= 1.0):
            raise ValueError("Opacity must be a number between 0 and 1.")
        self.config["configuration"]["props"]["opacity"] = opacity
        return self

    def set_min_resolution(self, min_resolution: int):
        """
        Set the minimum resolution for the layer to be visible in the map.

        Args:
            min_resolution (int)

        Returns:
            LayerConfigurationBuilder: self (for chaining)
        """
        self.config["configuration"]["props"]["minResolution"] = min_resolution
        return self

    def set_max_resolution(self, max_resolution: int):
        """
        Set the maximum resolution for the layer to be visible in the map.

        Args:
            max_resolution (int)

        Returns:
            LayerConfigurationBuilder: self (for chaining)
        """
        self.config["configuration"]["props"]["maxResolution"] = max_resolution
        return self

    def set_min_zoom(self, min_zoom: int):
        """
        Set the minimum zoom for the layer to be visible in the map.

        Args:
            min_zoom (int)

        Returns:
            LayerConfigurationBuilder: self (for chaining)
        """
        self.config["configuration"]["props"]["minZoom"] = min_zoom
        return self

    def set_max_zoom(self, max_zoom: int):
        """
        Set the maximum zoom for the layer to be visible in the map.

        Args:
            max_zoom (int)

        Returns:
            LayerConfigurationBuilder: self (for chaining)
        """
        self.config["configuration"]["props"]["maxZoom"] = max_zoom
        return self

    def set_min_zoom_query(self, min_zoom_query: int):
        """
        Set the minimum zoom needed for layer querying. If the map is zoomed out beyond the
        minimum zoom and the layer is clicked, then the map will zoom to the configured
        min_zoom_query value. If the map is zoomed in closer than the min_zoom_query and
        the layer is clicked, then the layer will be queried.

        Args:
            min_zoom_query (int)

        Returns:
            LayerConfigurationBuilder: self (for chaining)
        """
        self.config["configuration"]["props"]["minZoomQuery"] = min_zoom_query
        return self

    def set_source_properties(self, **kwargs):
        """
        Set arbitrary properties on the layer's data source.

        These properties will be added to the 'props' dictionary under the layer's 'source' configuration.
        Useful for configuring service-specific options like URL, params, or attribution.

        Check https://tethysdashdocs.readthedocs.io/en/latest/maps/source_tab.html for more
        information on available properties

        Args:
            **kwargs: Arbitrary keyword arguments representing source configuration options.

        Example:
            builder.set_source_properties(url="https://example.com/tiles")
        """
        self.config["configuration"]["props"]["source"]["props"].update(kwargs)
        return self

    def get_layer_names(self):
        """
        Retrieve the names of layers associated with the configured layer source.

        This method determines how to extract layer names based on the type of data source
        configured in the configuration.

        Returns:
            list[str]: A list of layer names derived from the source configuration.

        Raises:
            NotImplementedError: If the layer source type does not support name extraction.

        Supported layer sources:
            - "ESRI Image and Map Service": Fetches layer names from the ArcGIS service.
            - "WMS": Uses parameters to determine layer names.
            - "GeoJSON": Returns the builder's configured layer name.
            - "ESRI Feature Service": Returns the builder's configured layer name.
        """
        source_props = self.config["configuration"]["props"]["source"]["props"]
        url = source_props.get("url")

        if self.layer_source == "ESRI Image and Map Service":
            return self._get_arcgis_layer_names(url)
        elif self.layer_source == "WMS":
            return self._get_wms_layer_names(source_props.get("params", {}))
        elif self.layer_source == "GeoJSON":
            return [self.name]
        elif self.layer_source == "ESRI Feature Service":
            return [self.name]
        else:
            raise NotImplementedError(
                f"{self.layer_source} is not currently configured to return layer names"
            )

    def get_layer_attributes(self):
        """
        Retrieve attribute names from the configured layer source.

        This method extracts and returns a list of attributes associated with the specified
        data source, depending on the layer type. Attributes typically represent fields or
        properties available in the data (e.g., column names in a feature layer).

        Returns:
            list[str] | dict[str, list[dict[str, str]]]:
                A list of attribute names for most layer types.
                For WMS layers, returns a dictionary mapping layer names to lists of
                attribute dictionaries with 'name' and 'alias'.

        Raises:
            NotImplementedError: If the configured `layer_source` is not supported.
            ValueError: If required source properties (e.g., `layer` for ESRI Feature Service) are missing.

        Supported layer sources:
            - "ESRI Image and Map Service": Extracts fields from an ArcGIS image/map service.
            - "WMS": Parses WFS DescribeFeatureType to extract attributes per layer.
            - "GeoJSON": Extracts property names from features.
            - "ESRI Feature Service": Queries fields from a specific layer in the service.
        """
        source_props = self.config["configuration"]["props"]["source"]["props"]

        url = source_props.get("url")
        params = source_props.get("params", {})
        layer_number = source_props.get("layer")

        if self.layer_source == "ESRI Image and Map Service":
            return self._get_arcgis_image_attributes(url)
        elif self.layer_source == "WMS":
            return self._get_wms_attributes(url, params)
        elif self.layer_source == "GeoJSON":
            return self._get_geojson_attributes()
        elif self.layer_source == "ESRI Feature Service":
            return self._get_arcgis_feature_service_attributes(url, layer_number)
        else:
            raise NotImplementedError(
                f"{self.layer_source} is not currently configured to return attributes"
            )

    def _get_arcgis_layer_names(self, url):
        """
        Fetch the list of layer names from an ArcGIS Map or Image Service.

        Args:
            url (str): The base URL of the ArcGIS service.

        Returns:
            list[str]: A list of layer names defined in the ArcGIS service.

        Raises:
            ValueError: If `url` is not provided.
            requests.HTTPError: If the HTTP request to the ArcGIS service fails.
            requests.RequestException: For other network-related errors.
        """
        if not url:
            raise ValueError(
                "url must be provided. Set using .set_source_properties(url='some_url')"
            )
        response = requests.get(f"{url}?f=json")
        response.raise_for_status()
        data = response.json()
        return [layer["name"] for layer in data.get("layers", [])]

    def _get_arcgis_image_attributes(self, url):
        """
        Retrieve attribute metadata from an ArcGIS Image or Map Service.

        This method queries the service endpoint and each individual layer within it
        to extract attribute field information (name and alias) for all layers.

        Args:
            url (str): The base URL of the ArcGIS Image or Map Service.

        Returns:
            dict[str, list[dict[str, str]]]: A dictionary where each key is a layer name,
            and each value is a list of attribute dictionaries with `name` and `alias` keys.

        Raises:
            ValueError: If `url` is not provided.
            requests.HTTPError: If a request to the ArcGIS service or layer fails.
            requests.RequestException: For other network-related errors.
        """
        if not url:
            raise ValueError(
                "url must be provided. Set using .set_source_properties(url='some_url')"
            )
        response = requests.get(f"{url}?f=json")
        response.raise_for_status()
        data = response.json()
        attributes = {}
        for index, layer in enumerate(data.get("layers", [])):
            name = layer["name"]
            layer_url = f"{url}/{index}?f=json"
            layer_data = requests.get(layer_url).json()
            fields = [
                {"name": f["name"], "alias": f["alias"]}
                for f in layer_data.get("fields", [])
            ]
            attributes[name] = fields
        return attributes

    def _get_arcgis_feature_service_attributes(self, url, layer_number):
        """
        Retrieve attribute metadata from a specific layer of an ArcGIS Feature Service.

        This method queries a single feature layer endpoint to extract attribute field
        information (name and alias).

        Args:
            url (str): The base URL of the ArcGIS Feature Service (excluding layer number).
            layer_number (int): The index number of the specific layer to query.

        Returns:
            dict[str, list[dict[str, str]]]: A dictionary with the layer name as the key,
            and a list of attribute dictionaries (each with `name` and `alias` keys) as the value.

        Raises:
            ValueError: If `url` or `layer_number` is not provided.
            requests.HTTPError: If the request to the service fails.
            requests.RequestException: For network-related issues.
        """
        if not url:
            raise ValueError(
                "url must be provided. Set using .set_source_properties(url='some_url')"
            )

        if layer_number is None:
            raise ValueError(
                "layer (index number) must be provided. Set using .set_source_properties(layer=0)"
            )

        layer_url = f"{url.rstrip('/')}/{layer_number}?f=json"
        response = requests.get(layer_url)
        response.raise_for_status()
        data = response.json()
        fields = [
            {"name": f["name"], "alias": f["alias"]} for f in data.get("fields", [])
        ]
        return {self.name: fields}

    def _get_wms_layer_names(self, params):
        """
        Extract layer names from WMS parameters.

        This method checks for a "layers" or "LAYERS" key in the provided parameters
        and returns a list of individual layer names by splitting on commas.

        Args:
            params (dict): Dictionary containing WMS parameters.

        Returns:
            list[str]: List of layer names. Returns an empty list if no layers are found.
        """
        layers = params.get("layers") or params.get("LAYERS")

        if not layers:
            raise ValueError(
                "layers must be provided. Set using .set_source_properties(params={'LAYERS': 'some_layers'})"
            )

        return layers.split(",") if layers else []

    def _get_wms_attributes(self, url, params):
        """
        Fetch and parse WMS layer attributes using WFS DescribeFeatureType requests.

        This method sends a WFS DescribeFeatureType request for each layer specified in the
        WMS parameters, parses the returned XML schema, and extracts attribute names
        (excluding 'the_geom').

        Args:
            url (str): Base URL of the WMS/WFS service.
            params (dict): Dictionary of WMS parameters, typically including 'layers' or 'LAYERS'.

        Returns:
            dict: A dictionary mapping each layer name (lowercase) to a list of attribute names.

        Raises:
            ValueError: If no valid layer names are provided or schema parsing fails.
            RuntimeError: If the DescribeFeatureType request fails or returns an exception.
        """
        if not url:
            raise ValueError(
                "url must be provided. Set using .set_source_properties(url='some_url')"
            )

        layers = params.get("layers") or params.get("LAYERS") or ""

        if not layers:
            raise ValueError(
                "layers must be provided. Set using .set_source_properties(params={'LAYERS': 'some_layers'})"
            )

        layer_names = [l.strip().lower() for l in layers.split(",") if l.strip()]
        if not layer_names:
            raise ValueError("No valid layer names found in parameters.")

        all_attributes = {}

        for layer in layer_names:
            query_params = {
                "service": "WFS",
                "request": "describeFeatureType",
                "typename": layer,
            }

            response = requests.get(url, params=query_params)
            try:
                response.raise_for_status()
            except requests.HTTPError as e:
                raise RuntimeError(
                    f"Failed to fetch DescribeFeatureType for layer '{layer}': {e}"
                )

            text = response.text
            if "ExceptionReport" in text:
                raise RuntimeError(
                    f"WFS ExceptionReport received for layer '{layer}'. Check if WFS is enabled and layer name is correct."
                )

            parsed = xmltodict.parse(text)
            schema = parsed.get("xsd:schema") or parsed.get("schema")
            if not schema:
                raise ValueError(
                    f"Missing root xsd:schema element in XML for layer '{layer}'"
                )

            complex_types = schema.get("xsd:complexType") or schema.get("complexType")
            if not complex_types:
                raise ValueError(f"No complexType found in schema for layer '{layer}'")

            if isinstance(complex_types, dict):
                complex_types = [complex_types]

            attributes = []

            for ctype in complex_types:
                sequence = (
                    ctype.get("xsd:complexContent", {})
                    .get("xsd:extension", {})
                    .get("xsd:sequence", {})
                )
                elements = sequence.get("xsd:element", [])

                if isinstance(elements, dict):
                    elements = [elements]

                for element in elements:
                    name = element.get("@name")
                    if name and name != "the_geom":
                        attributes.append(name)

            all_attributes[layer] = attributes

        return all_attributes

    def _get_geojson_attributes(self):
        """
        Extract attribute names from a GeoJSON source.

        This method parses the provided GeoJSON object (or JSON string), collects all property
        keys from its features, and returns them as both names and aliases.

        Returns:
            dict: A dictionary mapping the layer name to a list of attribute dicts.
                Each dict contains 'name' and 'alias' keys.

        Raises:
            ValueError: If no GeoJSON is configured.
        """
        geojson = self.config["configuration"]["props"]["source"]["geojson"]
        if not geojson:
            raise ValueError(
                "geojson must be provided. Set the geojson using the set_geojson method"
            )

        if isinstance(geojson, str):
            import json

            geojson = json.loads(geojson)
        features = geojson.get("features", [])
        keys = set()
        for f in features:
            keys.update(f.get("properties", {}).keys())
        return {self.name: [{"name": k, "alias": k} for k in keys]}

    def add_attribute_alias(self, key, alias, layer_name=None):
        """
        Add a human-readable alias for a data attribute on a layer.

        This helps map internal attribute keys (from the data source) to more user-friendly labels
        that can be used in popups.

        Args:
            key (str): The original attribute key from the data.
            alias (str): The alias or display name to use for the attribute.
            layer_name (str, optional): The name of the layer to apply the alias to.
                Defaults to the builder's layer name if not provided.

        Example:
            builder.add_attribute_alias("elev", "Elevation (m)")
        """
        layer_key = layer_name or self.name

        if layer_key not in self.config["attributeAliases"]:
            self.config["attributeAliases"][layer_key] = {}

        self.config["attributeAliases"][layer_key][key] = alias
        return self

    def add_attribute_variable(self, key, variable, layer_name=None):
        """
        Add a variable for a data attribute on a layer.

        This helps map queried fields to dashboard variables that can be used for
        adding dynamic updates to other dashboard components.

        Args:
            key (str): The original attribute key from the data.
            variable (str): The variable to update or create.
            layer_name (str, optional): The name of the layer to apply the alias to.
                Defaults to the builder's layer name if not provided.

        Example:
            builder.add_attribute_alias("elev", "Elevation")
        """
        layer_key = layer_name or self.name

        if layer_key not in self.config["attributeVariables"]:
            self.config["attributeVariables"][layer_key] = {}

        self.config["attributeVariables"][layer_key][key] = variable
        return self

    def omit_popup_attribute(self, key, layer_name=None):
        """
        Mark an attribute key to be omitted from popups for a given layer.

        This is useful to hide less relevant or sensitive attributes from user-facing popups
        when displaying feature information on a map.

        Args:
            key (str): The attribute key to omit from popups.
            layer_name (str, optional): The name of the layer to apply the omission to.
                Defaults to the builder's layer name if not provided.

        Example:
            builder.omit_popup_attribute("internal_id")
        """
        layer_key = layer_name or self.name

        if layer_key not in self.config["omittedPopupAttributes"]:
            self.config["omittedPopupAttributes"][layer_key] = []

        self.config["omittedPopupAttributes"][layer_key].append(key)
        return self

    def build(self):
        return self.config


def validate_geojson(data):
    if not isinstance(data, dict):
        raise ValueError("GeoJSON must be a dictionary.")

    geojson_type = data.get("type")
    if not isinstance(geojson_type, str):
        raise ValueError("Missing or invalid 'type' field in GeoJSON.")

    valid_types = {
        "FeatureCollection",
        "Feature",
        "Point",
        "MultiPoint",
        "LineString",
        "MultiLineString",
        "Polygon",
        "MultiPolygon",
        "GeometryCollection",
    }

    if geojson_type not in valid_types:
        raise ValueError(f"Unsupported GeoJSON type: '{geojson_type}'.")

    if geojson_type == "FeatureCollection":
        features = data.get("features")
        if features is None:
            raise ValueError("'FeatureCollection' must include a 'features' field.")
        if not isinstance(features, list):
            raise ValueError("'features' must be a list.")
        if not all(isinstance(f, dict) for f in features):
            raise ValueError("Each feature in 'features' must be a dictionary.")

    elif geojson_type == "Feature":
        geometry = data.get("geometry")
        if geometry is None:
            raise ValueError("'Feature' must include a 'geometry' field.")
        if not isinstance(geometry, dict):
            raise ValueError("'geometry' must be a dictionary.")
        if "type" not in geometry:
            raise ValueError("'geometry' is missing 'type'.")
        if "coordinates" not in geometry:
            raise ValueError("'geometry' is missing 'coordinates'.")

    elif geojson_type == "GeometryCollection":
        geometries = data.get("geometries")
        if geometries is None:
            raise ValueError("'GeometryCollection' must include 'geometries' field.")
        if not isinstance(geometries, list):
            raise ValueError("'geometries' must be a list.")
        if not all(isinstance(g, dict) for g in geometries):
            raise ValueError("Each geometry in 'geometries' must be a dictionary.")

    else:  # Geometry types
        if "coordinates" not in data:
            raise ValueError(f"'{geojson_type}' object must contain 'coordinates'.")

    # Optional CRS validation
    crs = data.get("crs")
    if crs is not None:
        if not isinstance(crs, dict):
            raise ValueError("'crs' must be a dictionary.")
        props = crs.get("properties")
        if not isinstance(props, dict):
            raise ValueError("'crs.properties' must be a dictionary.")
        name = props.get("name")
        if not isinstance(name, str):
            raise ValueError("'crs.properties.name' must be a string.")

    return True  # Passed all checks
