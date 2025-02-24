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
    "nh3",
    "pytest-django",
    "pytest-mock",
    "pytest-cov",
    "intake",
    "djangorestframework",
    "alembic"
]

# -- Get Resource File -- #
resource_files = find_all_resource_files(app_package, TethysAppBase.package_namespace)

django.setup()

setup(
    name=release_package,
    version="0.7.1",
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
