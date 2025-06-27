import os
import shutil
import importlib
from pathlib import Path
from importlib.metadata import entry_points
import subprocess
import intake


def get_intake_plugin_modules():
    eps = entry_points()
    intake_eps = eps.select(group="intake.drivers")
    return {ep.name: ep.module for ep in intake_eps}


def copy_plugin_images(plugin_modules, static_plugin_images):
    for source, module in plugin_modules.items():
        found = False
        try:
            mod = importlib.import_module(module)
            mod_path = Path(mod.__file__).resolve()
            mod_path_parts = module.split(".")
            plugin_root = mod_path.parents[len(mod_path_parts) - 2]

            static_dir = plugin_root / "static"

            # Check for .png, then .jpeg, then .jpg
            for ext in [".png", ".jpeg", ".jpg"]:
                image_path = static_dir / f"{source}{ext}"
                if image_path.exists():
                    found = True
                    break  # Stop at the first match

            if not found:
                try:
                    visualization_type = intake.source.registry[
                        source
                    ].visualization_type
                except AttributeError:
                    print(f"--> {source} is not a tethysdash plugin")
                    continue

                if visualization_type == "image":
                    image_path = "default_image.png"
                elif visualization_type == "text":
                    image_path = "default_text.png"
                elif visualization_type == "variableInput":
                    image_path = "default_variable_input.png"
                elif visualization_type == "map":
                    image_path = "default_map.png"
                elif visualization_type == "plotly":
                    image_path = "default_chart.png"
                elif visualization_type == "card":
                    image_path = "default_card.png"
                elif visualization_type == "table":
                    image_path = "default_table.png"
                elif visualization_type == "custom":
                    image_path = "default_custom.png"
                else:
                    print(f"--> PNG thumbnail not available for {source}")

            print(f"Adding to static folder - {source}")
            static_file = os.path.join(static_plugin_images, f"{source}.png")
            shutil.copyfile(image_path, static_file)

        except ModuleNotFoundError:
            continue


def main():
    static_plugin_images = "./public/images/plugins"
    if not os.path.exists(static_plugin_images):
        print("Creating static plugin folder")
        os.makedirs(static_plugin_images)

    print("Getting installed intake drivers")
    plugins = get_intake_plugin_modules()

    print("Checking for plugin thumbnails")
    copy_plugin_images(plugins, static_plugin_images)

    print("Running collect static")
    # Run a simple command and get the output
    result = subprocess.run(
        ["tethys", "manage", "collectstatic", "tethysdash", "--noinput"],
        capture_output=True,
        text=True,
    )

    # Check if the command was successful
    if result.returncode == 0:
        print("Command executed successfully:")
        print(result.stdout)
    else:
        print("Command failed with error:")
        print(result.stderr)


if __name__ == "__main__":
    main()
