// Wires the render-job mirror to Firestore. The one place firebase-admin and
// the mirror meet; everything else works against the `MirrorDb` interface.
//
// Note there is no cast here: the real Firestore client satisfies `MirrorDb`
// structurally, which is what makes the test double in `adgenMirror.test.ts`
// evidence about the real thing rather than about a cast.

import * as admin from 'firebase-admin'
import { createRenderJobMirror } from '../adgenMirror'

// Lazy: `admin.firestore()` requires an initialised app, which the routes'
// `import '@/lib/api-auth'` side effect provides.
export const renderJobMirror = createRenderJobMirror(() => admin.firestore())
