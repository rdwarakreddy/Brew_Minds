/**
 * GoogleButton.jsx
 * ---------------------------------------------------------------------
 * Renders Google's own "Sign in with Google" button using Google
 * Identity Services (the <script> tag loaded in index.html). Google
 * renders the actual button UI into our container div and calls
 * `onIdToken` with a signed ID token once the user picks an account --
 * that token is what we send to POST /api/auth/google for the backend
 * to verify. We never handle the user's Google password or profile
 * data directly; Google does all of that in its own popup/flow.
 *
 * WHY THIS NEEDS TO BE MORE CAREFUL THAN A NAIVE useEffect:
 *   1. The GIS script tag in index.html loads with `async defer`, so
 *      `window.google` may not exist yet the moment this component
 *      mounts -- we poll briefly instead of assuming it's ready.
 *   2. `onIdToken` is a new function reference on every parent render
 *      (it's defined inline in Login/Register), so a naive dependency
 *      array would re-run the effect and call `renderButton` again on
 *      every keystroke, stacking up duplicate buttons inside the
 *      container. We store the latest callback in a ref instead, and
 *      only initialize/render Google's button ONCE.
 *   3. If the Client ID is missing/blank (e.g. .env not set up yet),
 *      we show an inline message instead of silently rendering nothing,
 *      so the failure is obvious during setup instead of looking like
 *      "Google sign-in doesn't work."
 */

import { useEffect, useRef, useState } from 'react';

export default function GoogleButton({ onIdToken }) {
  const containerRef = useRef(null);
  const callbackRef = useRef(onIdToken);
  const hasRenderedRef = useRef(false);
  const [loadError, setLoadError] = useState('');

  // Always call the LATEST onIdToken, without that being a reason to
  // re-initialize Google's button.
  useEffect(() => {
    callbackRef.current = onIdToken;
  }, [onIdToken]);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setLoadError('Google sign-in is not configured (VITE_GOOGLE_CLIENT_ID is missing).');
      return;
    }
    if (clientId.startsWith('YOUR_') || clientId.includes('YOUR_GOOGLE')) {
      // Still the placeholder from .env.example -- attempting real OAuth
      // against it would just fail with a confusing Google-branded error
      // inside the popup. Fail clearly here instead, with the actual fix.
      setLoadError(
        'Google sign-in needs your own Google Cloud OAuth Client ID before it will work -- see EXECUTION.md, section 5.'
      );
      return;
    }

    let cancelled = false;
    let pollTimer = null;
    let attempts = 0;

    function tryInitialize() {
      if (cancelled || hasRenderedRef.current) return;

      const gsi = window.google?.accounts?.id;
      if (!gsi || !containerRef.current) {
        // The GIS script (loaded with async/defer in index.html) may not
        // have executed yet -- keep polling briefly rather than giving up.
        attempts += 1;
        if (attempts > 100) {
          // ~10s of polling at 100ms; something is genuinely wrong
          // (script blocked, offline, ad-blocker) rather than just slow.
          setLoadError('Could not load Google sign-in. Check your connection and reload.');
          return;
        }
        pollTimer = setTimeout(tryInitialize, 100);
        return;
      }

      try {
        gsi.initialize({
          client_id: clientId,
          callback: (response) => {
            // eslint-disable-next-line no-console
            console.log('[GoogleButton] Credential received from Google.');
            callbackRef.current?.(response.credential);
          },
          ux_mode: 'popup',
          // Avoids a stale/blocked auto-select flow that can otherwise
          // make the button silently appear to "do nothing" on click
          // for a returning user in some browser configurations.
          auto_select: false,
          // Recommended by Google for Safari's Intelligent Tracking
          // Prevention so the upgraded (FedCM-based) experience is used
          // there instead of a broken/legacy fallback.
          itp_support: true,
          error_callback: (err) => {
            // eslint-disable-next-line no-console
            console.error('[GoogleButton] Google Identity Services error_callback fired:', err);
            setLoadError('Google sign-in failed to open. Please try again.');
          },
        });

        // Defensive: clear the container first in case of a fast-refresh /
        // re-mount, so we never end up with two buttons stacked.
        containerRef.current.innerHTML = '';
        gsi.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          shape: 'pill',
          text: 'continue_with',
        });
        hasRenderedRef.current = true;
        // eslint-disable-next-line no-console
        console.log('[GoogleButton] initialize() + renderButton() completed without throwing.');

        // Google renders its button asynchronously inside the container
        // (a cross-origin iframe). If the Client ID's Authorized
        // JavaScript origins don't include the exact origin this page is
        // running on, Google silently declines to render anything here --
        // no error is thrown or passed to error_callback, the container
        // just stays empty forever, which looks identical to "the button
        // is broken" with zero explanation. Checking for that and saying
        // so explicitly turns a silent dead end into an actionable message.
        setTimeout(() => {
          if (!cancelled && containerRef.current && containerRef.current.children.length === 0) {
            console.error(
              '[GoogleButton] Google did not render anything into the container. This almost always ' +
                'means the Client ID\'s Authorized JavaScript origins (Google Cloud Console) do not include ' +
                `this exact origin: ${window.location.origin}`
            );
            setLoadError(
              `Google didn't render its sign-in button for ${window.location.origin}. In Google Cloud Console, add this exact origin to the Client ID's Authorized JavaScript origins (see EXECUTION.md, section 5).`
            );
          }
        }, 2000);
      } catch (err) {
        setLoadError('Google sign-in failed to initialize.');
        // eslint-disable-next-line no-console
        console.error('Google Identity Services error:', err);
      }
    }

    tryInitialize();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
    // Intentionally empty dep array beyond mount: we only want this to
    // run once per mount, using the ref for the latest callback (see above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadError) {
    return <p className="text-center text-xs text-danger">{loadError}</p>;
  }

  return <div ref={containerRef} className="flex justify-center" />;
}
