# Product Requirements

## Core Problem
Rural Indian farmers lose crops to diseases because they lack access to expert diagnostics in areas with poor internet.

## User Stories
- **Primary:** As a farmer in a remote field, I want to scan a diseased leaf offline so that I can get immediate treatment advice without traveling to the city.
- **Secondary:** As an extension worker, I want a reliable tool to validate my field diagnoses even when I'm in a "dead zone."

## Must-Have Features (v1)
1. **Crop Selector:** Visual selection for Paddy, Tomato, and Groundnut.
2. **Offline Leaf Scanner:** AI inference on-device using camera/gallery.
3. **Disease Report Card:** Structured offline results with name, severity, and treatment (organic + chemical).

## Success Metrics
- **Accuracy:** ≥85% Top-1 accuracy on field images.
- **Performance:** Inference < 4s on 2GB RAM device.
- **Offline:** 100% functionality for the core diagnostic loop without internet.
