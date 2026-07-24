## 2026-07-16T00:11:34Z

You are teamwork_preview_explorer. Your working directory is C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle2\.
Your task is to analyze and design the Bidirectional Communication & Event Bridge (postMessage) Design for Kakao Maps WebView in Anyway, the Sea.
In Cycle 1, the Critic suggested:
1. Proxying user geolocation from React Native native Location watch APIs into the WebView (instead of letting WebView request raw geolocation).
2. Implementing a global window.onerror listener and window.console.log proxy in the WebView to route errors and logs back to Metro console.
3. Intercepting Kakao Maps script load failures (e.g. onerror hook on script tag) to notify React Native of SDK load failure.
4. Designing a robust postMessage message protocol.

Your objective for Cycle 2:
1. Specify the exact postMessage message protocol schema. Define all event types (e.g. MAP_READY, SPOT_SELECTED, SDK_LOAD_FAILED, WEB_ERROR, CONSOLE_LOG, etc.) sent from Web to React Native, and the Javascript inject functions (e.g. window.updateUserLocation, window.updateSpots, window.focusSpot) called from React Native to WebView.
2. Provide concrete HTML script templates for console.log proxying, global error interception, and script onerror fallback triggers.
3. Write your findings and proposal to C:\Users\user\Desktop\school_contest\Anyway_the_Sea\.agents\teamwork_preview_explorer_map_cycle2\analysis.md.
Report back with send_message once done.
