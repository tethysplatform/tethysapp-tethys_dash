from tethysapp.tethysdash.plugin_helpers import (
    LayerConfigurationBuilder,
    validate_geojson,
)
import requests
import pytest
import re


def test_layer_configuration_builder_ESRI_map(mocker):
    mock_requests_get = mocker.patch("tethysapp.tethysdash.plugin_helpers.requests.get")
    mock_response = mock_requests_get.return_value
    mock_response.raise_for_status.return_value = None
    mock_response.json.side_effect = [
        {"layers": [{"name": "some layer"}]},
        {"layers": [{"name": "some layer"}]},
        {"fields": [{"name": "field", "alias": "Field"}]},
    ]

    builder = LayerConfigurationBuilder("test", "ESRI Image and Map Service")
    builder.set_source_properties(
        url="https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer"  # noqa: E501
    )
    layer_names = builder.get_layer_names()

    mock_requests_get.assert_called_once_with(
        "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer?f=json"  # noqa: E501
    )
    assert layer_names == ["some layer"]

    layer_attributes = builder.get_layer_attributes()
    assert layer_attributes == {"some layer": [{"alias": "Field", "name": "field"}]}


def test_layer_configuration_builder_ESRI_map_error(mocker):
    mock_requests_get = mocker.patch("tethysapp.tethysdash.plugin_helpers.requests.get")
    mock_response = mock_requests_get.return_value
    mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError(
        "404 Client Error"
    )

    builder = LayerConfigurationBuilder("test", "ESRI Image and Map Service")

    with pytest.raises(
        ValueError,
        match=re.escape(
            "url must be provided. Set using .set_source_properties(url='some_url')"
        ),
    ):
        builder.get_layer_names()

    with pytest.raises(
        ValueError,
        match=re.escape(
            "url must be provided. Set using .set_source_properties(url='some_url')"
        ),
    ):
        builder.get_layer_attributes()

    builder.set_source_properties(
        url="https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer"  # noqa: E501
    )

    with pytest.raises(requests.exceptions.HTTPError, match="404 Client Error"):
        builder.get_layer_names()


def test_layer_configuration_builder_GeoJSON():
    data = {
        "type": "FeatureCollection",
        "crs": {"properties": {"name": "EPSG:4326"}},
        "features": [
            {
                "type": "Feature",
                "properties": {"prop1": 1},
                "geometry": {"type": "Point", "coordinates": [-112, 25]},
            }
        ],
    }
    layer_name = "test"

    builder = LayerConfigurationBuilder(layer_name, "GeoJSON")
    builder.set_geojson(data)
    layer_names = builder.get_layer_names()

    assert layer_names == [layer_name]

    layer_attributes = builder.get_layer_attributes()
    assert layer_attributes == {layer_name: [{"alias": "prop1", "name": "prop1"}]}


def test_layer_configuration_builder_GeoJSON_no_data():
    layer_name = "test"

    builder = LayerConfigurationBuilder(layer_name, "GeoJSON")
    layer_names = builder.get_layer_names()

    assert layer_names == [layer_name]

    with pytest.raises(
        ValueError,
        match="geojson must be provided. Set the geojson using the set_geojson method",
    ):
        builder.get_layer_attributes()


def test_layer_configuration_builder_WMS(mocker):
    mock_requests_get = mocker.patch("tethysapp.tethysdash.plugin_helpers.requests.get")
    mock_response = mock_requests_get.return_value
    mock_response.raise_for_status.return_value = None
    mock_response.text = '<?xml version="1.0" encoding="UTF-8"?><xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:topp="http://www.openplans.org/topp" xmlns:wfs="http://www.opengis.net/wfs/2.0" elementFormDefault="qualified" targetNamespace="http://www.openplans.org/topp"><xsd:import namespace="http://www.opengis.net/gml/3.2" schemaLocation="https://ahocevar.com/geoserver/schemas/gml/3.2.1/gml.xsd"/><xsd:complexType name="statesType"><xsd:complexContent><xsd:extension base="gml:AbstractFeatureType"><xsd:sequence><xsd:element maxOccurs="1" minOccurs="0" name="the_geom" nillable="true" type="gml:MultiSurfacePropertyType"/><xsd:element maxOccurs="1" minOccurs="0" name="STATE_NAME" nillable="true" type="xsd:string"/></xsd:sequence></xsd:extension></xsd:complexContent></xsd:complexType><xsd:element name="states" substitutionGroup="gml:AbstractFeature" type="topp:statesType"/></xsd:schema>'  # noqa: E501

    builder = LayerConfigurationBuilder("test", "WMS")
    builder.set_source_properties(
        url="http://localhost:8181/geoserver/wms",
        params={"LAYERS": "tiger:poly_landmarks,topp:states"},
    )
    layer_names = builder.get_layer_names()

    assert layer_names == ["tiger:poly_landmarks", "topp:states"]

    layer_attributes = builder.get_layer_attributes()
    assert layer_attributes == {
        "tiger:poly_landmarks": ["STATE_NAME"],
        "topp:states": ["STATE_NAME"],
    }


def test_layer_configuration_builder_WMS_errors(mocker):
    mock_requests_get = mocker.patch("tethysapp.tethysdash.plugin_helpers.requests.get")
    mock_response = mock_requests_get.return_value
    mock_response.raise_for_status.side_effect = requests.HTTPError("404 Client Error")
    builder = LayerConfigurationBuilder("test", "WMS")

    with pytest.raises(
        ValueError,
        match=re.escape(
            "layers must be provided. Set using .set_source_properties(params={'LAYERS': 'some_layers'})"  # noqa: E501
        ),
    ):
        builder.get_layer_names()

    with pytest.raises(
        ValueError,
        match=re.escape(
            "layers must be provided. Set using .set_source_properties(params={'LAYERS': 'some_layers'})"  # noqa: E501
        ),
    ):
        builder.get_layer_attributes()

    builder.set_source_properties(
        params={"LAYERS": "tiger:poly_landmarks,topp:states"},
    )
    layer_names = builder.get_layer_names()
    assert layer_names == ["tiger:poly_landmarks", "topp:states"]

    with pytest.raises(
        ValueError,
        match=re.escape(
            "url must be provided. Set using .set_source_properties(url='some_url')"
        ),
    ):
        builder.get_layer_attributes()

    builder.set_source_properties(
        url="http://localhost:8181/geoserver/wms",
    )

    with pytest.raises(
        RuntimeError,
        match="Failed to fetch DescribeFeatureType for layer 'tiger:poly_landmarks': 404 Client Error",  # noqa: E501
    ):
        builder.get_layer_attributes()


def test_layer_configuration_builder_WMS_Exception_Report(mocker):
    mock_requests_get = mocker.patch("tethysapp.tethysdash.plugin_helpers.requests.get")
    mock_response = mock_requests_get.return_value
    mock_response.raise_for_status.return_value = None
    mock_response.text = '<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE ServiceExceptionReport SYSTEM "https://ahocevar.com/geoserver/schemas/wms/1.1.1/WMS_exception_1_1_1.dtd"> <ServiceExceptionReport version="1.1.1" >   <ServiceException code="LayerNotDefined" locator="MapLayerInfoKvpParser">topp:tasmania_cities: no such layer on this server</ServiceException></ServiceExceptionReport>'  # noqa: E501

    builder = LayerConfigurationBuilder("test", "WMS")
    builder.set_source_properties(
        url="http://localhost:8181/geoserver/wms",
        params={"LAYERS": "tiger:poly_landmarks,topp:states"},
    )

    with pytest.raises(
        RuntimeError,
        match="WFS ExceptionReport received for layer 'tiger:poly_landmarks'. Check if WFS is enabled and layer name is correct.",  # noqa: E501
    ):
        builder.get_layer_attributes()


def test_layer_configuration_builder_WMS_schema_error(mocker):
    mock_requests_get = mocker.patch("tethysapp.tethysdash.plugin_helpers.requests.get")
    mock_response = mock_requests_get.return_value
    mock_response.raise_for_status.return_value = None
    mock_response.text = (
        '<?xml version="1.0" encoding="UTF-8"?><someOtherElement></someOtherElement>'
    )

    builder = LayerConfigurationBuilder("test", "WMS")
    builder.set_source_properties(
        url="http://localhost:8181/geoserver/wms",
        params={"LAYERS": "tiger:poly_landmarks,topp:states"},
    )

    with pytest.raises(
        ValueError,
        match="Missing root xsd:schema element in XML for layer 'tiger:poly_landmarks'",
    ):
        builder.get_layer_attributes()


def test_layer_configuration_builder_WMS_complexType_error(mocker):
    mock_requests_get = mocker.patch("tethysapp.tethysdash.plugin_helpers.requests.get")
    mock_response = mock_requests_get.return_value
    mock_response.raise_for_status.return_value = None
    mock_response.text = '<?xml version="1.0" encoding="UTF-8"?><xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:topp="http://www.openplans.org/topp" xmlns:wfs="http://www.opengis.net/wfs/2.0" elementFormDefault="qualified" targetNamespace="http://www.openplans.org/topp"></xsd:schema>'  # noqa: E501

    builder = LayerConfigurationBuilder("test", "WMS")
    builder.set_source_properties(
        url="http://localhost:8181/geoserver/wms",
        params={"LAYERS": "tiger:poly_landmarks,topp:states"},
    )

    with pytest.raises(
        ValueError,
        match="No complexType found in schema for layer 'tiger:poly_landmarks'",
    ):
        builder.get_layer_attributes()


def test_layer_configuration_builder_ESRI_feature(mocker):
    mock_requests_get = mocker.patch("tethysapp.tethysdash.plugin_helpers.requests.get")
    mock_response = mock_requests_get.return_value
    mock_response.raise_for_status.return_value = None
    mock_response.json.return_value = {"fields": [{"name": "field", "alias": "Field"}]}

    layer_name = "test"
    builder = LayerConfigurationBuilder(layer_name, "ESRI Feature Service")
    builder.set_source_properties(
        url="https://maps.water.noaa.gov/server/rest/services/rfc/rfc_based_5day_max_streamflow/FeatureServer",  # noqa: E501
        layer=0,
    )
    layer_names = builder.get_layer_names()

    assert layer_names == [layer_name]

    layer_attributes = builder.get_layer_attributes()

    mock_requests_get.assert_called_once_with(
        "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_based_5day_max_streamflow/FeatureServer/0?f=json"  # noqa: E501
    )
    assert layer_attributes == {layer_name: [{"alias": "Field", "name": "field"}]}


def test_layer_configuration_builder_ESRI_feature_errors():
    layer_name = "test"
    builder = LayerConfigurationBuilder(layer_name, "ESRI Feature Service")

    with pytest.raises(
        ValueError,
        match=re.escape(
            "url must be provided. Set using .set_source_properties(url='some_url')"
        ),
    ):
        builder.get_layer_attributes()

    builder.set_source_properties(
        url="https://maps.water.noaa.gov/server/rest/services/rfc/rfc_based_5day_max_streamflow/FeatureServer",  # noqa: E501
    )

    with pytest.raises(
        ValueError,
        match=re.escape(
            "layer (index number) must be provided. Set using .set_source_properties(layer=0)"  # noqa: E501
        ),
    ):
        builder.get_layer_attributes()


def test_layer_configuration_builder_invalid_source():
    with pytest.raises(
        ValueError,
        match="Invalid layer_source 'bad source'. Must be one of: Vector Tile, Image Tile, WMS, ESRI Image and Map Service, ESRI Feature Service, GeoJSON",  # noqa: E501
    ):
        LayerConfigurationBuilder("test", "bad source")


def test_layer_configuration_builder_build():
    builder = LayerConfigurationBuilder("test", "ESRI Image and Map Service")
    builder.set_source_properties(
        url="https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer"  # noqa: E501
    ).set_opacity(0.5).set_min_resolution(10).set_max_resolution(100).set_min_zoom(
        5
    ).set_max_zoom(
        50
    ).set_min_zoom_query(
        15
    ).set_layer_visibility(
        False
    ).set_queryable(
        False
    )
    config = builder.build()

    assert config == {
        "configuration": {
            "type": "ImageLayer",
            "props": {
                "maxResolution": 100,
                "maxZoom": 50,
                "minResolution": 10,
                "minZoom": 5,
                "minZoomQuery": 15,
                "opacity": 0.5,
                "name": "test",
                "source": {
                    "type": "ESRI Image and Map Service",
                    "props": {
                        "url": "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",  # noqa: E501
                    },
                },
            },
            "layerVisibility": False,
        },
        "queryable": False,
        "attributeAliases": {},
        "attributeVariables": {},
        "omittedPopupAttributes": {},
    }

    builder.add_attribute_alias("field", "Some Alias", "test").add_attribute_variable(
        "field", "Some Variable", "test"
    ).omit_popup_attribute("field", "test")
    config = builder.build()

    assert config == {
        "configuration": {
            "type": "ImageLayer",
            "props": {
                "maxResolution": 100,
                "maxZoom": 50,
                "minResolution": 10,
                "minZoom": 5,
                "minZoomQuery": 15,
                "opacity": 0.5,
                "name": "test",
                "source": {
                    "type": "ESRI Image and Map Service",
                    "props": {
                        "url": "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",  # noqa: E501
                    },
                },
            },
            "layerVisibility": False,
        },
        "queryable": False,
        "attributeAliases": {
            "test": {
                "field": "Some Alias",
            },
        },
        "attributeVariables": {
            "test": {
                "field": "Some Variable",
            },
        },
        "omittedPopupAttributes": {
            "test": [
                "field",
            ],
        },
    }


def test_layer_configuration_builder_build_required_fields():
    builder = LayerConfigurationBuilder(name="My Layer Name", layer_source="WMS")
    with pytest.raises(
        ValueError,
        match="Required fields validation failed:\nMissing required key 'url'\nMissing required key 'params.LAYERS'",  # noqa: E501
    ):
        builder.build()

    builder = LayerConfigurationBuilder(
        name="My Layer Name", layer_source="ESRI Feature Service"
    )
    with pytest.raises(
        ValueError,
        match="Required fields validation failed:\nMissing required key 'url'\nMissing required key 'layer'",  # noqa: E501
    ):
        builder.build()


def test_get_available_source_properties():
    builder = LayerConfigurationBuilder(name="My Layer Name", layer_source="WMS")
    available_properties = builder.get_available_source_properties()

    assert available_properties == {
        "required": {
            "url": "WMS service URL",
            "params": {
                "LAYERS": "<workspace>:<layerName>,<workspace>:<layerName>",
            },
        },
        "optional": {
            "attributions": "Attributions",
            "params": {
                "STYLES": "SLD (Styled Layer Descriptor) Name",
                "TIME": "yyyy-MM-ddThh:mm:ss.SSSZ",
            },
            "projection": "EPSG:<Code>",
        },
    }


def test_layer_configuration_builder_bad_opacity():
    builder = LayerConfigurationBuilder("test", "ESRI Image and Map Service")

    with pytest.raises(ValueError, match="Opacity must be a number between 0 and 1."):
        builder.set_opacity(2.5)


def test_layer_configuration_builder_not_implemented_get_layers_and_attrs():
    builder = LayerConfigurationBuilder("test", "Image Tile")

    with pytest.raises(
        NotImplementedError,
        match="Image Tile is not currently configured to return layer names",
    ):
        builder.get_layer_names()

    with pytest.raises(
        NotImplementedError,
        match="Image Tile is not currently configured to return attributes",
    ):
        builder.get_layer_attributes()


def test_validate_geojson_FeatureCollection():
    with pytest.raises(ValueError, match="GeoJSON must be a dictionary."):
        validate_geojson("")

    with pytest.raises(ValueError, match="Missing or invalid 'type' field in GeoJSON."):
        validate_geojson({})

    with pytest.raises(ValueError, match="Unsupported GeoJSON type: 'bad_type'."):
        validate_geojson({"type": "bad_type"})

    with pytest.raises(
        ValueError, match="'FeatureCollection' must include a 'features' field."
    ):
        validate_geojson({"type": "FeatureCollection"})

    with pytest.raises(ValueError, match="'features' must be a list."):
        validate_geojson({"type": "FeatureCollection", "features": {}})

    with pytest.raises(
        ValueError, match="Each feature in 'features' must be a dictionary."
    ):
        validate_geojson({"type": "FeatureCollection", "features": [""]})

    assert validate_geojson(
        {
            "type": "FeatureCollection",
            "crs": {"properties": {"name": "EPSG:4326"}},
            "features": [
                {
                    "type": "Feature",
                    "properties": {"prop1": 1},
                    "geometry": {"type": "Point", "coordinates": [-112, 25]},
                }
            ],
        }
    )


def test_validate_geojson_Feature():
    with pytest.raises(ValueError, match="'Feature' must include a 'geometry' field."):
        validate_geojson({"type": "Feature"})

    with pytest.raises(ValueError, match="'geometry' must be a dictionary."):
        validate_geojson({"type": "Feature", "geometry": ""})

    with pytest.raises(ValueError, match="'geometry' is missing 'type'."):
        validate_geojson({"type": "Feature", "geometry": {}})

    with pytest.raises(ValueError, match="'geometry' is missing 'coordinates'."):
        validate_geojson({"type": "Feature", "geometry": {"type": ""}})

    assert validate_geojson(
        {
            "type": "Feature",
            "crs": {"properties": {"name": "EPSG:4326"}},
            "geometry": {"type": "", "coordinates": [0, 1]},
        }
    )


def test_validate_geojson_GeometryCollection():
    with pytest.raises(
        ValueError, match="'GeometryCollection' must include 'geometries' field."
    ):
        validate_geojson({"type": "GeometryCollection"})

    with pytest.raises(ValueError, match="'geometries' must be a list."):
        validate_geojson({"type": "GeometryCollection", "geometries": {}})

    with pytest.raises(
        ValueError, match="Each geometry in 'geometries' must be a dictionary."
    ):
        validate_geojson({"type": "GeometryCollection", "geometries": [""]})

    assert validate_geojson(
        {
            "type": "GeometryCollection",
            "crs": {"properties": {"name": "EPSG:4326"}},
            "geometries": [{"type": "", "coordinates": [0, 1]}],
        }
    )


def test_validate_geojson_Point():
    with pytest.raises(ValueError, match="'Point' object must contain 'coordinates'."):
        validate_geojson({"type": "Point"})

    assert validate_geojson(
        {
            "type": "Point",
            "crs": {"properties": {"name": "EPSG:4326"}},
            "coordinates": [0, 1],
        }
    )


def test_validate_geojson_crs():
    with pytest.raises(ValueError, match="'crs' must be in the geojson"):
        validate_geojson(
            {
                "type": "Point",
                "coordinates": [0, 1],
            }
        )

    with pytest.raises(ValueError, match="'crs' must be a dictionary."):
        validate_geojson(
            {
                "type": "Point",
                "crs": "",
                "coordinates": [0, 1],
            }
        )

    with pytest.raises(ValueError, match="'crs.properties' must be a dictionary."):
        validate_geojson(
            {
                "type": "Point",
                "crs": {},
                "coordinates": [0, 1],
            }
        )

    with pytest.raises(ValueError, match="'crs.properties.name' must be a string."):
        validate_geojson(
            {
                "type": "Point",
                "crs": {"properties": {}},
                "coordinates": [0, 1],
            }
        )

    assert validate_geojson(
        {
            "type": "Point",
            "crs": {"properties": {"name": "EPSG:4326"}},
            "coordinates": [0, 1],
        }
    )
