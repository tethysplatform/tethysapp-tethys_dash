// Build a Uint8Array in the test realm.
//
// fflate's `strToU8` uses the native TextEncoder when one is available, and
// under jsdom that returns a Uint8Array belonging to the Node realm. fflate's
// own `instanceof Uint8Array` check then fails, so `zipSync` treats the value as
// a plain object and recurses into its byte indices -- producing archive members
// named "basins.shp/0/" instead of a file. Constructing here keeps the array in
// the realm the code under test compares against.
//
// Only fixture construction is affected; reading bytes back with `strFromU8`
// works across realms, and nothing in the application builds archives.
export function bytes(text) {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

/** Decode ASCII bytes back to a string, realm-independently. */
export function text(byteArray) {
  return Array.from(byteArray, (byte) => String.fromCharCode(byte)).join("");
}
