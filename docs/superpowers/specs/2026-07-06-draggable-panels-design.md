# Draggable Panel System Design

**Date:** 2026-07-06
**Status:** Approved
**Scope:** Replace fixed-position panels with a draggable, minimizable, closable window system

## 1. Problem

Current layout has 8 fixed-position panels pinned to screen edges with hardcoded pixel coordinates. They obstruct the 3D viewport, cannot be rearranged, and provide no collapse/close mechanism. At viewport widths below 1200px panels overlap; below 760px they stack as static blocks requiring manual scroll.

## 2. Solution Overview

Introduce a `PanelManager` + `DraggablePanel` system that wraps every existing panel. Panels start minimized (icons only) at launch, can be dragged freely, minimized to icons, or closed entirely. The 3D scene has maximum visibility.

## 3. Architecture

```
src/ui/
├── PanelManager.js      ← NEW: dock rendering, z-index stack, panel registry
├── DraggablePanel.js    ← NEW: per-panel wrapper (state, drag, animation)
├── ControlPanel.js      ← MODIFY: remove direct DOM query; return config
├── Hud.js               ← MODIFY: same
├── MissionSystem.js     ← MODIFY: same
├── ConceptPanel.js      ← MODIFY: same
├── QuizSystem.js        ← MODIFY: same
├── DataLogger.js        ← MODIFY: same
src/visual/
├── SpacetimeDiagram.js  ← MODIFY: same
src/core/
├── App.js               ← MODIFY: init PanelManager instead of direct setupUi
src/style.css            ← MODIFY: add dock, draggable, animation styles
index.html               ← MODIFY: remove hardcoded panel HTML sections
```

## 4. State Model

Three states per panel:

```
CLOSED ──[open from + menu]──→ MINIMIZED(icon) ──[click icon]──→ EXPANDED
  ↑                               ↑                               │
  └───────[click ✕]──────────────┘          [click ─]─────────────┘
```

- **EXPANDED**: Full panel visible, draggable. Title bar shows three buttons: `[─]` minimize, `[✕]` close.
- **MINIMIZED**: Icon only in dock. Click to expand at last position.
- **CLOSED**: Not visible anywhere. Reopen via `+` menu at bottom of dock.

## 5. Default State at Launch

| Panel | Initial State | Dock Side |
|---|---|---|
| Control Panel (⚙) | MINIMIZED | Left |
| Mission System (🎯) | MINIMIZED | Left |
| Data Logger (📝) | MINIMIZED | Left |
| HUD (📊) | MINIMIZED | Right |
| Concept Panel (📖) | MINIMIZED | Right |
| Quiz System (❓) | MINIMIZED | Right |
| Spacetime Diagram (⏱) | MINIMIZED | Right |
| Intro Panel | EXPANDED (center, dismissed on Start) | — |

## 6. Dock Layout

```
Left dock                     Right dock
┌──┐                          ┌──┐
│⚙│ Control                   │📊│ HUD
├──┤                          ├──┤
│🎯│ Missions                  │📖│ Concepts
├──┤                          ├──┤
│📝│ Log                       │❓│ Quiz
├──┤                          ├──┤
│＋│ More...                   │⏱│ Spacetime
└──┘                          └──┘
  left: 12px                    right: 12px
  top: 50%                      top: 50%
  translateY(-50%)              translateY(-50%)
```

- Icon buttons: 40×40px, border-radius 10px, bg `rgba(7,17,31,0.78)`, border `rgba(125,211,252,0.28)`
- Active (expanded) icon: gold border highlight
- Hover: border-color brightens, 150ms transition
- `+` button: opens dropdown listing closed panels; click reopens to minimized state

## 7. Expanded Panel Visuals

```
┌──────────────────────────────────┐
│ 🚀 飞船控制            [─] [✕] │  ← title bar 40px, drag handle
│                                  │
│  <original panel content>        │  ← existing panel styles preserved
│                                  │
└──────────────────────────────────┘
  min-width: 260px
  border-radius: 12px
  box-shadow: 0 18px 50px rgba(0,0,0,0.28)
  backdrop-filter: blur(10px)
```

Title bar buttons:
- `─` minimize → returns to icon in dock
- `✕` close → removes from dock, fully hidden

## 8. Interactions

### Drag
- Pointer Events on title bar
- Constrain to viewport (clamp left/top to keep at least 80px visible)
- Release: stay at dropped position, no snapback
- No transition during drag (instant follow)
- Click on panel body or title bar → bring to top (z-index)

### Minimize / Expand
- Animation: `scale(0.8)→scale(1)` + `opacity 0→1`, 200ms ease-out
- Expand position: last known position, or default position if first open

### Close
- Animation: `scale(1)→scale(0.9)` + `opacity 1→0`, 150ms ease-in
- Removed from dock; appears in `+` dropdown

### Event Passthrough
- Expanded panels capture pointer events
- Minimized state: only icons intercept clicks; 3D canvas receives all other events
- Three.js OrbitControls unaffected

## 9. PanelManager API

```js
class PanelManager {
  register(id, panelInstance, config)
    // config: { icon, dockSide, defaultPosition, defaultSize }

  expand(id)     // show panel expanded
  minimize(id)   // show panel as icon
  close(id)      // fully hide panel
  toggle(id)     // minimize ↔ expand
  bringToFront(id) // set highest z-index
}
```

## 10. CSS Changes

- Remove hardcoded `.panel` position rules (`.control-panel`, `.hud-panel`, etc.)
- Add `.dock-left`, `.dock-right`, `.dock-icon`, `.dock-plus`
- Add `.draggable-panel`, `.draggable-titlebar`, `.draggable-content`
- Add `.panel-minimizing`, `.panel-expanding`, `.panel-closing` animation keyframes
- Remove `@media` panel-position overrides — panel system handles layout at all widths
- Keep color variables, button styles, HUD grid, and other internal panel styles

## 11. HTML Changes

- Remove all `<section class="panel ...">` elements from `index.html`
- Add empty `<div id="dock-left">`, `<div id="dock-right">` containers
- Keep `<div id="app-root">` for Three.js canvas
- Panels are created dynamically by PanelManager from registered configs

## 12. What Does NOT Change

- Three.js scene setup, camera, renderer
- Physics computation (relativity.js)
- Visual components (StarField, Spacecraft, MeasurementRod, SceneObjects)
- Panel internal logic — each panel class keeps its init/update/render methods
- DataLogger — export still works
- WebXR / VRButton
- Mission/Quiz/Concept data files
