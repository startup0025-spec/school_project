# Absolute Unified Record Schema

## 1. Context & State
- User is still confused why the July 28th APK showed the Dev Client screen, claiming that "when I built with Expo last time, it didn't show this screen."
- The user does not understand the difference between EAS Build Profiles (`development` vs `production`/`preview`).
- An APK built with `--profile development` will always include `expo-dev-client` and show the launcher. An APK built with `--profile production` (or `eas build` default) embeds the JS and skips the launcher.

## 2. Intent & Rationale
- Comply with `[ALETHEIA PIPELINE LOCK]`.
- I will explain the Expo Build Profiles (`development` vs `production`) to completely clear the user's confusion.
- I will reassure them that the 143MB APK I just provided acts exactly like their old "good" Expo builds (Production mode).

## 3. Execution Log
- Wrote log.
- Delivering the explanation of Expo build profiles to the Master.
