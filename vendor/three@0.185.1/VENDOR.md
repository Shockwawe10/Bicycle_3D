# three.js r185 (npm three@0.185.1), vendored unmodified

Source: `npm pack three@0.185.1` (released 2026-07-01). Files copied byte-for-byte from the package:

| File | From package path | sha256 |
|---|---|---|
| three.module.min.js | build/three.module.min.js | 86bcee248b64f44bcfc23c331ae74619061957d59cab040171dcb6fb5900beb6 |
| three.core.min.js | build/three.core.min.js | 05b2609338c76cd65daf74f3ac515bc9a5045e1b3b33edc07d8c9bd55250fa90 |
| RoomEnvironment.js | examples/jsm/environments/RoomEnvironment.js | 55f466192cc84298755a424c5e040345006b2ee1455589b3b54126c2ea4123f4 |
| LICENSE | LICENSE (MIT) | |

Why 0.185.1: it is the newest patch release whose npm package still ships the official
minified builds (0.186.x dropped `build/*.min.js`). The official minified builds total
~189 KB gzip; a self-minified 0.186.1 measured 354 KB gzip.

`index.html` resolves `three` through an import map to `three.module.min.js`, which imports
`./three.core.min.js`; `RoomEnvironment.js` imports `three` through the same map.
