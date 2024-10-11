function getTethysPortalHost() {
  let tethys_portal_host = process.env.TETHYS_PORTAL_HOST;
  let tethys_prefix_url = process.env.TETHYS_PREFIX_URL.replace(/^\/|\/$/g, '');

  // If the .env property is not set, derive from current location
  if (!tethys_portal_host || !tethys_portal_host.length) {
      let currLocation = window.location.href;
      let url = new URL(currLocation);
      tethys_portal_host = url.origin;
  }
  // return tethys_portal_host;
  return `${tethys_portal_host}/${tethys_prefix_url}`;

}

export { getTethysPortalHost};