import intake


def get_available_visualizations():
    default_intake_sources = [
        "csv",
        "jsonfiles",
        "ndzarr",
        "numpy",
        "textfiles",
        "tiled_cat",
        "yaml_file_cat",
        "yaml_files_cat",
    ]

    available_intake_sources = list(intake.source.registry)
    valid_intake_sources = [
        source
        for source in available_intake_sources
        if source not in default_intake_sources
    ]

    available_visualizations = []
    for intake_source in valid_intake_sources:
        plugin = getattr(intake, f"open_{intake_source}")

        plugin_metadata = {
            "source": intake_source,
            "value": plugin.visualization_label,
            "label": plugin.visualization_label,
            "args": plugin.visualization_args,
            "type": plugin.visualization_type,
            "tags": getattr(plugin, "visualization_tags", []),
            "description": getattr(plugin, "visualization_description", ""),
        }

        existing_group = [
            d
            for d in available_visualizations
            if d.get("label") == plugin.visualization_group
        ]
        if existing_group:
            existing_group[0]["options"].append(plugin_metadata)
        else:
            available_visualizations.append(
                {"label": plugin.visualization_group, "options": [plugin_metadata]}
            )

    return {"visualizations": available_visualizations}


def get_visualization(viz_source, viz_args):
    plugin = getattr(intake, f"open_{viz_source}")

    data = plugin(**viz_args).read()

    return plugin.visualization_type, data
