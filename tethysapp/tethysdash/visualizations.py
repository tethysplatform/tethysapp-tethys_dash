import intake


def extract_argument_structure(d):
    result = {}

    def collect_subargs(sub_args):
        collected = []
        for key, value in sub_args.items():
            nested_keys = []
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, dict) and "sub_args" in item:
                        nested_result = collect_subargs(item["sub_args"])
                        nested_keys.extend(nested_result)
            if nested_keys:
                collected.append({key: nested_keys})
            else:
                collected.append(key)
        return collected

    for main_key, items in d.items():
        result[main_key] = []
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict) and "sub_args" in item:
                    result[main_key].extend(collect_subargs(item["sub_args"]))

    return result


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
            "args": extract_argument_structure(plugin.visualization_args),
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
