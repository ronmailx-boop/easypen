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
  // Upload key (created 6.11.2026 in Termux, store/termux.md)
  'BC:E6:52:49:E5:CE:2B:39:FB:62:69:AE:EA:80:1D:B1:46:C4:AD:50:AF:39:F8:2C:9A:6E:2D:CB:58:B2:22:DF'
  // TODO: App signing key certificate from Play Console (App integrity → App signing)
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
