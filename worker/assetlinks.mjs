/*
 * Digital Asset Links: tells Android that the EasyPen app (app.vplusstudio.easypen) belongs to
 * this site, so the app opens it full screen (Trusted Web Activity) with no browser bar.
 * Served at /.well-known/assetlinks.json by worker/index.mjs.
 *
 * SHA-256 fingerprints of the certificates that sign the app (public, not secrets):
 *  1. Play Console → the app → Test and release → App integrity → App signing →
 *     "App signing key certificate" (Google signs what users install with this one)
 *  2. the upload key (printed by the "Android - build" workflow), for testing a build directly
 */
export const FINGERPRINTS = [
  // 'AA:BB:...'
];

export function assetLinks() {
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'app.vplusstudio.easypen',
      sha256_cert_fingerprints: FINGERPRINTS
    }
  }];
}
