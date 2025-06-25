from setuptools import setup, find_namespace_packages
from tethys_apps.app_installation import find_all_resource_files
from tethys_apps.base.app_base import TethysAppBase
import django

# -- Apps Definition -- #
app_package = "tethysdash"
release_package = f"{TethysAppBase.package_namespace}-{app_package}"

# -- Python Dependencies -- #
dependencies = [
    "hjson==3.1",
    "nh3==0.2.21",
    "bleach==6.1.0",
    "bleach[css]",
    "cssutils==2.11.1",
    "pytest-django",
    "pytest-mock",
    "pytest-cov",
    "intake==2.0.7",
    "djangorestframework",
    "alembic==1.14.0",
]

# -- Get Resource File -- #
resource_files = find_all_resource_files(app_package, TethysAppBase.package_namespace)
resource_files.append("default_dashboard.png")
resource_files.append("default_card.png")
resource_files.append("default_chart.png")
resource_files.append("default_custom.png")
resource_files.append("default_image.png")
resource_files.append("default_map.png")
resource_files.append("default_table.png")
resource_files.append("default_text.png")
resource_files.append("default_variable_input.png")
resource_files.append("alembic.ini")

django.setup()

setup(
    name=release_package,
    version="0.11.4",
    description="",
    long_description="",
    keywords="",
    author="",
    author_email="",
    url="",
    license="",
    packages=find_namespace_packages(),
    package_data={"": resource_files},
    include_package_data=True,
    zip_safe=False,
    install_requires=dependencies,
)
