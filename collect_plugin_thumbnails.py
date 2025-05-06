import os
import shutil
import importlib
from pathlib import Path
from importlib.metadata import entry_points
import subprocess


def get_intake_plugin_modules():
    eps = entry_points()
    intake_eps = eps.select(group="intake.drivers")
    return {ep.name: ep.module for ep in intake_eps}


def discover_plugin_images(plugin_modules):
    image_paths = []
    for source, module in plugin_modules.items():
        try:
            mod = importlib.import_module(module)
            mod_path = Path(mod.__file__).resolve()
            mod_path_parts = module.split(".")
            plugin_root = mod_path.parents[len(mod_path_parts) - 1]

            static_dir = plugin_root / "static"

            # Check for .png, then .jpeg, then .jpg
            for ext in [".png", ".jpeg", ".jpg"]:
                image_path = static_dir / f"{source}{ext}"
                if image_path.exists():
                    image_paths.append(str(image_path))
                    break  # Stop at the first match

        except ModuleNotFoundError:
            continue
    return image_paths


def main():
    print("Getting installed intake drivers")
    plugins = get_intake_plugin_modules()

    print("Checking for plugin thumbnails")
    plugin_images = discover_plugin_images(plugins)

    print("Copying plugin thumbnails to static folder")
    static_plugin_images = "./tethysapp/tethysdash/public/images/plugins"
    if not os.path.exists(static_plugin_images):
        os.makedirs(static_plugin_images)

    for plugin_image in plugin_images:
        static_file = os.path.join(static_plugin_images, os.path.basename(plugin_image))
        shutil.copyfile(plugin_image, static_file)

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
