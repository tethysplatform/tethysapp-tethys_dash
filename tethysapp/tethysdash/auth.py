"""The app's own login check for controllers declared ``login_required=True``.

Tethys does not enforce ``login_required`` when the portal runs with
``ENABLE_OPEN_PORTAL``, and ``@api_view`` above ``@controller`` is not in the
request path, so the app checks the request's user itself.
"""

from functools import wraps

from django.http import JsonResponse


def require_login(controller_func):
    """Return the standard failure payload to a signed-out caller.

    Place it beneath ``@controller`` so it wraps the function directly and runs
    after Tethys has injected any path arguments. Refusals return status 200 like
    every other failure here, so each is also logged.
    """

    @wraps(controller_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            print(f"Refused a signed-out {request.method} request to {request.path}")
            return JsonResponse(
                {"success": False, "message": "You must be signed in to do that."}
            )
        return controller_func(request, *args, **kwargs)

    return wrapper
