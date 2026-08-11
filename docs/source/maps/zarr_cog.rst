.. _zarr_cog:

Zarr to GeoTIFF Endpoint
========================


TethysDash can render a raster layer directly from a public `Zarr <https://zarr.dev/>`_ store. The ``zarr/cog`` endpoint reads one 2-D slice of a variable on demand, converts it to a Cloud-Optimized GeoTIFF (COG) in memory, and streams it back — nothing is written to disk. Use the endpoint URL as the **url** of a :ref:`GeoTIFF source <source_tab>`.

------------------------------------------------------------------------------------------------------------------------

++++++++
zarr/cog
++++++++

**Endpoint:** ``/apps/tethysdash/zarr/cog/``

**Query parameters:**
    - **src:** (required) Public URL of the Zarr store (``http``, ``https``, or ``s3``).
    - **variable:** (required) Array name to read from the store.
    - **index:** (optional) Slice index along the leading dimension, for stores shaped ``[n, y, x]``. Default is ``0``.
    - **mask_below:** (optional) Sample values at or below this number render transparent.

Bind a :ref:`variable input <variableinputs>` to ``index`` with the ``${Variable Name}`` syntax to switch slices on the fly — for example, drive it with a slider to animate through a stacked variable:

::

    /apps/tethysdash/zarr/cog/?src=https://example.com/store.zarr&variable=depth&index=${Storm}

.. note::
    The store must be publicly reachable. Internal, loopback, and other non-public URLs are rejected.

------------------------------------------------------------------------------------------------------------------------

+++++++++
zarr/meta
+++++++++

The companion ``zarr/meta`` endpoint returns a store's selectable metadata, so a selector can be populated without downloading any raster data.

**Endpoint:** ``/apps/tethysdash/zarr/meta/``

**Query parameters:**
    - **src:** (required) Public URL of the Zarr store.
    - **variable:** (optional) Reference array. Defaults to the first griddable array.
    - **candidates:** (optional) Comma-separated array names to probe when the store cannot be listed.
    - **label_var:** (optional) 1-D array whose values label each slice.

The response includes ``variables``, ``slice_count``, ``slice_labels``, ``crs``, ``grid_shape``, and ``extent``.
