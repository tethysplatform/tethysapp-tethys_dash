from tethysapp.tethysdash.plugin_helpers import (
    LayerConfigurationBuilder,
    validate_geojson,
    send_websocket_message,
    TethysDashPlugin,
    DATE_PRESET_SENTINELS,
)
import requests
import pytest
import re
from pathlib import Path
from datetime import datetime


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


def test_layer_configuration_builder_build_required_fields_partial_params():
    builder = LayerConfigurationBuilder(name="My Layer Name", layer_source="WMS")
    builder.set_source_properties(
        url="http://example.com/wms",
        params={"STYLES": "default"},
    )
    with pytest.raises(
        ValueError,
        match="Required fields validation failed:\nMissing required key 'params.LAYERS'",  # noqa: E501
    ):
        builder.build()


def test_validate_required_fields_deeply_nested_missing():
    builder = LayerConfigurationBuilder(name="x", layer_source="GeoJSON")
    required = {"a": {"b": {"c": "value"}}}
    actual = {}
    with pytest.raises(
        ValueError,
        match=re.escape("Missing required key 'a.b.c'"),
    ):
        builder._validate_required_fields(required, actual)


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


def test_send_websocket_message_success(mocker):
    # Patch get_channel_layer and async_to_sync
    mock_channel_layer = mocker.Mock()
    mock_async_to_sync = mocker.Mock()
    mock_group_send = mocker.Mock()
    mock_async_to_sync.return_value = mock_group_send
    mocker.patch(
        "channels.layers.get_channel_layer",
        return_value=mock_channel_layer,
    )
    mocker.patch("asgiref.sync.async_to_sync", mock_async_to_sync)

    send_websocket_message("reqid", {"foo": "bar"}, percentage_complete=50)

    mock_async_to_sync.assert_called_once()
    mock_group_send.assert_called_once_with(
        "dashboard_updates",
        {
            "type": "send_message",
            "message": {
                "message": {"foo": "bar"},
                "requestId": "reqid",
                "percentageComplete": 50,
            },
        },
    )


def test_send_websocket_message_exception(mocker):
    # Patch get_channel_layer and async_to_sync to raise exception
    mock_async_to_sync = mocker.Mock(side_effect=Exception("fail"))
    mocker.patch(
        "channels.layers.get_channel_layer",
        return_value=mocker.Mock(),
    )
    mocker.patch("asgiref.sync.async_to_sync", mock_async_to_sync)

    # Should not raise
    send_websocket_message("reqid", {"foo": "bar"})


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


def test_validate_geojson_url():

    assert validate_geojson("https://example.com/some.geojson")


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


def test_layer_configuration_builder_legend():
    builder = LayerConfigurationBuilder("test", "ESRI Image and Map Service")
    builder.set_source_properties(
        url="https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer"  # noqa: E501
    ).set_legend("default")
    config = builder.build()

    assert config == {
        "configuration": {
            "type": "ImageLayer",
            "props": {
                "name": "test",
                "source": {
                    "type": "ESRI Image and Map Service",
                    "props": {
                        "url": "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",  # noqa: E501
                    },
                },
            },
        },
        "legend": "default",
    }

    builder.set_legend(None)
    config = builder.build()
    assert config == {
        "configuration": {
            "type": "ImageLayer",
            "props": {
                "name": "test",
                "source": {
                    "type": "ESRI Image and Map Service",
                    "props": {
                        "url": "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",  # noqa: E501
                    },
                },
            },
        }
    }

    with pytest.raises(
        ValueError,
        match=re.escape("legend must be 'default', None, or a valid dictionary."),
    ):
        builder.set_legend("bad legend")

    with pytest.raises(
        ValueError,
        match=re.escape("a dictionary legend must have a title and items key"),
    ):
        builder.set_legend({"title": "My Legend"})

    with pytest.raises(
        ValueError,
        match=re.escape("dictionary legend items must be a list"),
    ):
        builder.set_legend({"title": "My Legend", "items": "not a list"})

    with pytest.raises(
        ValueError,
        match=re.escape("Item at index 0 is not a dictionary"),
    ):
        builder.set_legend({"title": "My Legend", "items": ["not a dict"]})

    with pytest.raises(
        ValueError,
        match=re.escape("Item at index 0 is missing keys: {'color'}"),
    ):
        builder.set_legend(
            {"title": "My Legend", "items": [{"label": "Item 1", "symbol": "circle"}]}
        )

    builder.set_legend(
        {
            "title": "My Legend",
            "items": [{"label": "Item 1", "symbol": "circle", "color": "#FF0000"}],
        }
    )
    config = builder.build()
    assert config == {
        "configuration": {
            "type": "ImageLayer",
            "props": {
                "name": "test",
                "source": {
                    "type": "ESRI Image and Map Service",
                    "props": {
                        "url": "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",  # noqa: E501
                    },
                },
            },
        },
        "legend": {
            "title": "My Legend",
            "items": [{"label": "Item 1", "symbol": "circle", "color": "#FF0000"}],
        },
    }


def test_layer_configuration_builder_style():
    builder = LayerConfigurationBuilder("test", "ESRI Image and Map Service")
    builder.set_source_properties(
        url="https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer"  # noqa: E501
    ).set_style("some/url/style.json")
    config = builder.build()

    assert config == {
        "configuration": {
            "type": "ImageLayer",
            "props": {
                "name": "test",
                "source": {
                    "type": "ESRI Image and Map Service",
                    "props": {
                        "url": "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",  # noqa: E501
                    },
                },
            },
            "style": "some/url/style.json",
        },
    }

    with pytest.raises(
        ValueError,
        match=re.escape("style must be a valid dictionary."),
    ):
        builder.set_style("bad legend")

    builder.set_style(
        {
            "version": 8,
            "sources": {
                "my_source": {
                    "type": "raster",
                    "tiles": ["https://example.com/tiles/{z}/{x}/{y}.png"],
                }
            },
            "layers": [
                {
                    "id": "my_layer",
                    "type": "raster",
                    "source": "my_source",
                }
            ],
        }
    )
    config = builder.build()
    assert config == {
        "configuration": {
            "type": "ImageLayer",
            "props": {
                "name": "test",
                "source": {
                    "type": "ESRI Image and Map Service",
                    "props": {
                        "url": "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",  # noqa: E501
                    },
                },
            },
            "style": {
                "version": 8,
                "sources": {
                    "my_source": {
                        "type": "raster",
                        "tiles": ["https://example.com/tiles/{z}/{x}/{y}.png"],
                    }
                },
                "layers": [
                    {
                        "id": "my_layer",
                        "type": "raster",
                        "source": "my_source",
                    }
                ],
            },
        },
    }


def test_parse_date_input_valid():
    from tethysapp.tethysdash.plugin_helpers import parse_date_input
    import datetime

    # Valid date
    result = parse_date_input("12/25/2023")
    assert isinstance(result, datetime.datetime)
    assert result == datetime.datetime(2023, 12, 25, 0, 0)


def test_parse_date_input_invalid():
    from tethysapp.tethysdash.plugin_helpers import parse_date_input
    import pytest

    # Invalid format
    with pytest.raises(ValueError):
        parse_date_input("2023-12-25")
    # Not a string
    with pytest.raises(TypeError):
        parse_date_input(20231225)


def test_parse_date_hour_input_valid():
    from tethysapp.tethysdash.plugin_helpers import parse_date_hour_input
    import datetime

    # Valid date and hour
    result = parse_date_hour_input("12/25/2023 02:30 PM")
    assert isinstance(result, datetime.datetime)
    assert result == datetime.datetime(2023, 12, 25, 14, 30)


def test_parse_date_hour_input_invalid():
    from tethysapp.tethysdash.plugin_helpers import parse_date_hour_input
    import pytest

    # Invalid format
    with pytest.raises(ValueError):
        parse_date_hour_input("2023-12-25 14:30")
    # Not a string
    with pytest.raises(TypeError):
        parse_date_hour_input(202312251430)


class MinimalPlugin(TethysDashPlugin):
    name = "minimal"
    group = "TestGroup"
    label = "Minimal Plugin"
    type = "plotly"
    args = {"foo": "bar", "fooDate": "date"}
    tags = ["tag1"]
    description = "desc"
    restricted = True
    loading_icon = False
    attribution = "attr"

    def run(self):
        return "ran"


class MinimalPlugin2(TethysDashPlugin):
    name = "minimal"
    visualization_group = "TestGroup"
    visualization_label = "Minimal Plugin"
    visualization_type = "plotly"
    visualization_args = {"foo": "bar"}
    visualization_tags = ["tag1"]
    visualization_description = "desc"
    visualization_restricted = True
    visualization_loading_icon = False
    visualization_attribution = "attr"

    def run(self):
        return "ran"


def test_plugin_init_and_attributes():
    plugin = MinimalPlugin()
    assert plugin.name == "minimal"
    assert plugin.group == "TestGroup"
    assert plugin.label == "Minimal Plugin"
    assert plugin.type == "plotly"
    assert plugin.args == {"foo": "bar", "fooDate": "date"}
    assert plugin.tags == ["tag1"]
    assert plugin.description == "desc"
    assert plugin.restricted is True
    assert plugin.loading_icon is False
    assert plugin.attribution == "attr"


def test_plugin2_init_and_attributes():
    plugin = MinimalPlugin2()
    assert plugin.name == "minimal"
    assert plugin.group == "TestGroup"
    assert plugin.label == "Minimal Plugin"
    assert plugin.type == "plotly"
    assert plugin.args == {"foo": "bar"}
    assert plugin.tags == ["tag1"]
    assert plugin.description == "desc"
    assert plugin.restricted is True
    assert plugin.loading_icon is False
    assert plugin.attribution == "attr"


def test_plugin_run_and_read():
    plugin = MinimalPlugin()
    assert plugin.run() == "ran"
    # read should call run and set request_id
    result = plugin.read("reqid")
    assert result == "ran"
    assert plugin.request_id == "reqid"


def test_plugin_required_fields():
    # Missing name
    class NoName(TethysDashPlugin):
        group = "g"
        label = "l"
        type = "plotly"

    with pytest.raises(ValueError, match="name attribute"):
        NoName()

    # Missing type
    class NoType(TethysDashPlugin):
        name = "n"
        group = "g"
        label = "l"

    with pytest.raises(ValueError, match="type attribute"):
        NoType()

    # Missing label
    class NoLabel(TethysDashPlugin):
        name = "n"
        group = "g"
        type = "plotly"

    with pytest.raises(ValueError, match="label attribute"):
        NoLabel()

    # Missing group
    class NoGroup(TethysDashPlugin):
        name = "n"
        label = "l"
        type = "plotly"

    with pytest.raises(ValueError, match="group attribute"):
        NoGroup()


def test_plugin_type_validation():
    class BadType(TethysDashPlugin):
        name = "n"
        group = "g"
        label = "l"
        type = "not_a_type"

    with pytest.raises(ValueError, match="not valid"):
        BadType()


def test_plugin_args_and_tags_types():
    class BadArgs(TethysDashPlugin):
        name = "n"
        group = "g"
        label = "l"
        type = "plotly"
        args = "notadict"

    with pytest.raises(ValueError, match="args must be a dictionary"):
        BadArgs()

    class BadTags(TethysDashPlugin):
        name = "n"
        group = "g"
        label = "l"
        type = "plotly"
        tags = "notalist"

    with pytest.raises(ValueError, match="tags must be a list"):
        BadTags()


def test_plugin_reserved_keys():
    class ReservedArgs(TethysDashPlugin):
        name = "n"
        group = "g"
        label = "l"
        type = "plotly"
        args = {"label": "bad"}

    with pytest.raises(ValueError, match="reserved keys"):
        ReservedArgs()


def test_plugin_dotted_arg_names_rejected():
    # "." is reserved as the nested-arg path delimiter, so a top-level arg name
    # containing one would make get_arg()/sub_args() paths ambiguous.
    class DottedArgs(TethysDashPlugin):
        name = "n"
        group = "g"
        label = "l"
        type = "plotly"
        args = {"transect_location.location": "text"}

    with pytest.raises(ValueError, match="path delimiter"):
        DottedArgs()


def test_plugin_run_not_implemented():
    class NoRun(TethysDashPlugin):
        name = "n"
        group = "g"
        label = "l"
        type = "plotly"

    plugin = NoRun()
    with pytest.raises(NotImplementedError):
        plugin.run()


def test_plugin_send_update(monkeypatch):
    plugin = MinimalPlugin()
    plugin.request_id = "reqid"
    called = {}

    def fake_send_websocket_message(
        request_id, message, percentage_complete=None, **kwargs
    ):
        called["args"] = (request_id, message, percentage_complete)
        called["kwargs"] = kwargs

    monkeypatch.setattr(
        "tethysapp.tethysdash.plugin_helpers.send_websocket_message",
        fake_send_websocket_message,
    )
    plugin.send_update("msg", percentage_complete=42)
    assert called["args"] == ("reqid", "msg", 42)
    # layer_id defaults to None (no pending layer context for a non-runtime plugin)
    assert called["kwargs"] == {"layer_id": None}


def test_plugin_kwargs_are_set():
    plugin = MinimalPlugin(foo=123, fooDate="2023-01-01")
    assert plugin.foo == 123
    assert plugin.fooDate == datetime(2023, 1, 1, 0, 0)


def test_date_preset_sentinel_passes_through_unparsed():
    # A "date" arg holding the "latest" sentinel must reach run() as the raw
    # string, not crash dateutil.parse or coerce to a datetime.
    plugin = MinimalPlugin(foo=123, fooDate="latest")
    assert plugin.fooDate == "latest"
    assert isinstance(plugin.fooDate, str)


def test_non_date_arg_equal_to_sentinel_is_unaffected():
    # Only "date"-typed args are gated; a non-date arg whose value happens to
    # equal the sentinel string is set verbatim (as it always was).
    plugin = MinimalPlugin(foo="latest", fooDate="2023-01-01")
    assert plugin.foo == "latest"
    assert plugin.fooDate == datetime(2023, 1, 1, 0, 0)


def test_get_arg_returns_flat_and_dotted_values():
    plugin = MinimalPlugin(foo=123, **{"transect_location.location": "L"})
    assert plugin.get_arg("foo") == 123
    # Dotted keys are read reliably here even though attribute access cannot
    # resolve them via self.transect_location.location.
    assert plugin.get_arg("transect_location.location") == "L"
    assert plugin.get_arg("missing") is None
    assert plugin.get_arg("missing", "default") == "default"


def test_received_args_reflects_parsed_dates():
    plugin = MinimalPlugin(foo=1, fooDate="2023-01-01")
    # Stored post-parse, so get_arg agrees with attribute access for date args.
    assert plugin.received_args["fooDate"] == datetime(2023, 1, 1, 0, 0)
    assert plugin.get_arg("fooDate") == datetime(2023, 1, 1, 0, 0)
    assert plugin.received_args["foo"] == 1


def test_sub_args_returns_immediate_children_only():
    plugin = MinimalPlugin(
        **{
            "loc": "sel",
            "loc.lat": 1,
            "loc.lon": 2,
            "loc.box.x": 3,  # deeper descendant — excluded
            "other": 9,
        }
    )
    assert plugin.sub_args("loc") == {"lat": 1, "lon": 2}
    assert plugin.sub_args("missing") == {}


def test_nested_arg_delimiter_matches_frontend():
    # Parity guard: the frontend builds nested arg keys as
    # `${parentKey}.${obj.name}` (VisualizationPane.js renderArgs). That "." is
    # the same delimiter get_arg()/sub_args() split on. If the frontend changed
    # the separator, nested-arg reads would silently break.
    repo_root = Path(__file__).resolve().parents[4]
    pane = (
        repo_root
        / "reactapp"
        / "components"
        / "modals"
        / "DataViewer"
        / "VisualizationPane.js"
    ).read_text()
    assert "${parentKey}.${obj.name}" in pane


def test_date_preset_sentinels_match_frontend():
    # Parity guard: the backend skip-parse set must match the frontend preset
    # list. There is no shared FE/BE constants mechanism, so drift between
    # DATE_PRESET_SENTINELS and DATE_PRESETS would silently break the feature.
    repo_root = Path(__file__).resolve().parents[4]
    date_utils = (
        repo_root / "reactapp" / "components" / "inputs" / "dateUtils.js"
    ).read_text()

    array_match = re.search(r"export const DATE_PRESETS\s*=\s*\[([^\]]*)\]", date_utils)
    assert array_match, "Could not find DATE_PRESETS in dateUtils.js"

    # DATE_PRESETS references string constants (e.g. LATEST_PRESET); resolve them.
    const_values = dict(re.findall(r'export const (\w+)\s*=\s*"([^"]+)"', date_utils))
    frontend_presets = set()
    for token in array_match.group(1).split(","):
        token = token.strip()
        if not token:
            continue
        if token in const_values:
            frontend_presets.add(const_values[token])
        else:
            frontend_presets.add(token.strip("\"'"))

    assert frontend_presets == DATE_PRESET_SENTINELS


# --- Runtime-capable plugin tests -------------------------------------------


class MinimalRuntimePlugin(TethysDashPlugin):
    name = "minimal_runtime"
    group = "TestGroup"
    label = "Minimal Runtime Plugin"
    type = "map_layer"
    dynamic_map_layer = True
    args = {"bbox": "text"}

    def run(self):
        return {
            "configuration": {
                "type": "VectorLayer",
                "props": {
                    "name": "runtime layer",
                    "source": {"type": "GeoJSON", "props": {}},
                },
            }
        }

    def fetch_features(self):
        return {
            "type": "FeatureCollection",
            "features": [],
            "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        }


def test_runtime_plugin_init_and_read_features():
    plugin = MinimalRuntimePlugin()
    assert plugin.dynamic_map_layer is True
    result = plugin.read_features("req-a:grid-b:layer-c")
    assert plugin.request_id == "req-a:grid-b:layer-c"
    assert result["type"] == "FeatureCollection"
    assert result["features"] == []


def test_dynamic_map_layer_flag_without_method_raises():
    class BadRuntime(TethysDashPlugin):
        name = "bad_runtime"
        group = "g"
        label = "l"
        type = "map_layer"
        dynamic_map_layer = True

    with pytest.raises(ValueError, match="fetch_features to be overridden"):
        BadRuntime()


def test_fetch_features_without_flag_warns():
    class DormantRuntime(TethysDashPlugin):
        name = "dormant"
        group = "g"
        label = "l"
        type = "map_layer"

        def fetch_features(self):
            return {}

    with pytest.warns(UserWarning, match="will not be invoked at runtime"):
        DormantRuntime()


def test_runtime_plugin_multi_level_inheritance_valid():
    class IntermediateRuntime(TethysDashPlugin):
        name = "intermediate"
        group = "g"
        label = "l"
        type = "map_layer"
        dynamic_map_layer = True

        def fetch_features(self):
            return {
                "type": "FeatureCollection",
                "features": [],
                "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
            }

    class ChildRuntime(IntermediateRuntime):
        name = "child"

    child = ChildRuntime()
    assert child.dynamic_map_layer is True
    result = child.read_features("rid")
    assert result["type"] == "FeatureCollection"


def test_runtime_plugin_fetch_features_not_implemented():
    """Runtime-capable plugins that somehow bypass init validation still
    surface a clear error when fetch_features is not overridden."""

    class ForgottenRuntime(TethysDashPlugin):
        name = "forgotten"
        group = "g"
        label = "l"
        type = "map_layer"

    # This one is allowed (not dynamic_map_layer), but calling fetch_features
    # directly should still raise the default NotImplementedError.
    plugin = ForgottenRuntime()
    with pytest.raises(NotImplementedError, match="fetch_features"):
        plugin.fetch_features()


def test_runtime_plugin_send_update_attaches_pending_layer_id(monkeypatch):
    plugin = MinimalRuntimePlugin()
    plugin.request_id = "sess:grid:layer-7"
    plugin._pending_layer_id = "layer-7"
    called = {}

    def fake_send_websocket_message(request_id, message, **kwargs):
        called["request_id"] = request_id
        called["message"] = message
        called["kwargs"] = kwargs

    monkeypatch.setattr(
        "tethysapp.tethysdash.plugin_helpers.send_websocket_message",
        fake_send_websocket_message,
    )
    plugin.send_update("p", percentage_complete=50)
    assert called["request_id"] == "sess:grid:layer-7"
    assert called["kwargs"].get("layer_id") == "layer-7"


def test_runtime_plugin_send_update_explicit_layer_id_overrides(monkeypatch):
    plugin = MinimalRuntimePlugin()
    plugin.request_id = "sess:grid:layer-7"
    plugin._pending_layer_id = "layer-7"
    called = {}

    def fake_send_websocket_message(request_id, message, **kwargs):
        called["kwargs"] = kwargs

    monkeypatch.setattr(
        "tethysapp.tethysdash.plugin_helpers.send_websocket_message",
        fake_send_websocket_message,
    )
    plugin.send_update("p", percentage_complete=50, layer_id="explicit")
    assert called["kwargs"].get("layer_id") == "explicit"


# --- validate_feature_collection tests --------------------------------------


def _valid_fc(features=None):
    return {
        "type": "FeatureCollection",
        "features": features or [],
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
    }


def test_validate_feature_collection_happy_path():
    from tethysapp.tethysdash.plugin_helpers import validate_feature_collection

    assert validate_feature_collection(_valid_fc()) is True


def test_validate_feature_collection_empty_ok():
    from tethysapp.tethysdash.plugin_helpers import validate_feature_collection

    assert validate_feature_collection(_valid_fc(features=[])) is True


def test_validate_feature_collection_none_raises():
    from tethysapp.tethysdash.plugin_helpers import validate_feature_collection

    with pytest.raises(ValueError, match="returned None"):
        validate_feature_collection(None)


def test_validate_feature_collection_scaffold_detection():
    from tethysapp.tethysdash.plugin_helpers import validate_feature_collection

    # Dict containing scaffold-shape keys at the top level is rejected.
    for offending_key in ["style", "legend", "source", "props", "configuration"]:
        payload = {
            "type": "FeatureCollection",
            offending_key: {},
            "features": [],
            "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        }
        with pytest.raises(ValueError, match="configure-time scaffold"):
            validate_feature_collection(payload)


def test_validate_feature_collection_missing_crs_raises():
    from tethysapp.tethysdash.plugin_helpers import validate_feature_collection

    with pytest.raises(ValueError, match="crs"):
        validate_feature_collection({"type": "FeatureCollection", "features": []})


# --- send_websocket_message layer_id tests ----------------------------------


def test_send_websocket_message_includes_layer_id(mocker):
    mock_channel_layer = mocker.MagicMock()
    mocker.patch("channels.layers.get_channel_layer", return_value=mock_channel_layer)
    mocker.patch(
        "asgiref.sync.async_to_sync",
        lambda fn: fn,
    )
    mock_channel_layer.group_send.return_value = None

    send_websocket_message(
        "sess:grid:layer-1",
        "progress",
        percentage_complete=10,
        layer_id="layer-1",
    )
    call_args = mock_channel_layer.group_send.call_args
    assert call_args is not None
    _, payload = call_args.args
    assert payload["message"]["layerId"] == "layer-1"
    assert payload["message"]["requestId"] == "sess:grid:layer-1"
    assert payload["message"]["percentageComplete"] == 10


def test_send_websocket_message_omits_layer_id_when_none(mocker):
    mock_channel_layer = mocker.MagicMock()
    mocker.patch("channels.layers.get_channel_layer", return_value=mock_channel_layer)
    mocker.patch("asgiref.sync.async_to_sync", lambda fn: fn)
    mock_channel_layer.group_send.return_value = None

    send_websocket_message("grid-only", "progress", percentage_complete=20)
    _, payload = mock_channel_layer.group_send.call_args.args
    assert "layerId" not in payload["message"]


# --- LayerConfigurationBuilder.set_plugin_source tests ----------------------


def test_builder_set_plugin_source_happy_path():
    builder = LayerConfigurationBuilder("runtime layer", "GeoJSON")
    builder.set_plugin_source("my_runtime_plugin", {"bbox": "${BBox}"})
    config = builder.build()

    props = config["configuration"]["props"]
    assert props["pluginSource"] == {
        "source": "my_runtime_plugin",
        "args": {"bbox": "${BBox}"},
    }
    assert props["source"]["type"] == "GeoJSON"
    assert props["source"]["geojson"]["type"] == "FeatureCollection"
    assert props["source"]["geojson"]["features"] == []
    assert props["source"]["geojson"]["crs"]["properties"]["name"] == "EPSG:4326"


def test_builder_set_plugin_source_rejects_non_geojson():
    builder = LayerConfigurationBuilder("wms layer", "WMS")
    with pytest.raises(ValueError, match="must use LayerConfigurationBuilder"):
        builder.set_plugin_source("some_plugin", {})


def test_builder_set_plugin_source_rejects_non_dict_args():
    builder = LayerConfigurationBuilder("runtime layer", "GeoJSON")
    with pytest.raises(ValueError, match="args must be a dictionary"):
        builder.set_plugin_source("some_plugin", "not a dict")


def test_builder_build_skips_required_field_validation_for_runtime():
    """Runtime builds should not trip WMS/KML-style required-field checks.

    Since set_plugin_source already requires layer_source=='GeoJSON', the
    relevant assertion is that build() doesn't spuriously fail on a
    plugin-backed GeoJSON layer with no url/params set.
    """
    builder = LayerConfigurationBuilder("runtime layer", "GeoJSON")
    builder.set_plugin_source("p", {})
    # Should not raise.
    config = builder.build()
    assert "pluginSource" in config["configuration"]["props"]


def test_builder_build_preserves_static_behavior():
    """Non-runtime GeoJSON builders still work as before (pluginSource absent)."""
    builder = LayerConfigurationBuilder("static layer", "GeoJSON")
    builder.set_geojson(
        {
            "type": "FeatureCollection",
            "features": [],
            "crs": {"properties": {"name": "EPSG:4326"}},
        }
    )
    config = builder.build()
    assert "pluginSource" not in config["configuration"]["props"]


def test_builder_runtime_geojson_override():
    """If the plugin calls set_geojson with real features before set_plugin_source,
    those features persist (plugin may want to ship a seed state)."""
    seed = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {},
                "geometry": {"type": "Point", "coordinates": [0, 0]},
            }
        ],
        "crs": {"properties": {"name": "EPSG:4326"}},
    }
    builder = LayerConfigurationBuilder("runtime layer", "GeoJSON")
    builder.set_geojson(seed)
    builder.set_plugin_source("p", {})
    config = builder.build()
    assert (
        config["configuration"]["props"]["source"]["geojson"]["features"][0][
            "geometry"
        ]["type"]
        == "Point"
    )
