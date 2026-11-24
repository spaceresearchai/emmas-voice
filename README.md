# Emma's Voice — Tablet Speech & Lip-Tracking Companion

A calm, sensory-friendly tablet web app designed to help non-verbal autistic children practice producing words through live lip-movement tracking, visual imitation, and immediate spoken reinforcement.

## Features

- **Real-Time Camera Lip Tracking with Visible Guide Lines**: Uses MediaPipe Face Landmarker locally in the browser to draw glowing outer/inner lip contours, vertical lip-opening measurement lines, and horizontal mouth-width lines over the mirrored camera feed.
- **Instant Spoken Reinforcement**: Whenever lip movement is detected, the app immediately speaks the active target word out loud (Web Speech API) with gentle visual stars/bubbles and optional soft melodic chimes.
- **Watch & Copy Articulation Coach + Parent Real Videos**: Side panel demonstrates each word with a 60fps animated speaker synchronized syllable-by-syllable (with matching lip-tracking guide lines and `0.5×` Slow Mode), plus a built-in **Parent Video Recorder / Uploader** stored privately on the tablet via IndexedDB.
- **Tablet & Autism-Friendly Ergonomics**: Large touch targets, Calm Mode toggle, Child Lock (press-and-hold Parent Settings), adjustable lip sensitivity and cooldown, multi-language voice selection, and custom word creation.
- **100% Private**: All camera processing and parent-recorded videos stay locally on the device.
