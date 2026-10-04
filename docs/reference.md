# API guide

Import the public API in an authoring script, then execute it with `codeboard run`:

```js
import { StoryboardProject, brushes, renderFramePNG } from 'codeboard-studio';
```

## Document structure

| Object | Create or access it |
| --- | --- |
| Project | `StoryboardProject.create(options)`, `StoryboardProject.open(path)` |
| Sequence | `project.addSequence(name, id?)` |
| Scene | `project.addScene(name, id?)`, `sequence.addScene(name, id?)` |
| Shot | `scene.addShot(name, id?)` |
| Panel | `shot.addPanel(options)`, `project.panel(id)` |
| Layer | `panel.addRasterLayer`, `panel.addVectorLayer`, `panel.addGroup`, `panel.layer(id)` |
| Element | The ID returned by `rasterStroke`, `vectorStroke`, `path`, `text`, or `rasterSurface` |

Use stable IDs where later scripts need to find an object. A panel's duration is in frames; dimensions are canvas units.

## Task map

The [project and artwork API](api-project.md), [production API](api-production.md), [drawing and math API](api-drawing.md), [rendering API](api-render.md), and [storage API](api-storage.md) list callable signatures. [API types](api-types.md) gives the data shapes. These references accompany the task guides below; they do not replace a runnable example.

| Task | API and guide |
| --- | --- |
| Generate pen movement | `catmullRom`, `cubic`, `line`, `ellipse`, `samplePath`: [drawing](drawing.md) |
| Work in local or frame coordinates | Matrix helpers, coordinate queries, two-bone IK: [math](math.md) |
| Reuse a prop or character drawing | Component capture, instances, explicit refresh: [components](components.md) |
| Paint or edit contours | `rasterStroke`, `erase`, `vectorStroke`, `path`, `edit`: [drawing](drawing.md) |
| Edit pixels | `rasterSurface`, `readPixels`, `editPixels`, pixel selection helpers: [drawing](drawing.md#work-with-pixels) |
| Author a brush | `customizeBrush`, `brushTipFromFunction`, `renderBrushSwatch`: [brushes](brushes.md) |
| Import a tip or preset | `importBrushResource`, `brushFromResource`: [brushes](brushes.md#import-a-bitmap-tip) |
| Compose artwork | `layer.set`, `project.select`, `production.moveLayer`, `production.reparentLayer`: [layers](layers.md) |
| Change drawings over time | `setDrawingSequence`, `setDrawingRange`, `drawingNeighbors`: [animation](animation.md) |
| Animate properties | Layer and camera keyframe methods: [animation](animation.md), [camera](camera.md) |
| Place sound | Asset, audio track, and clip methods: [audio](audio.md) |
| Inspect a result | `renderDetail`, `renderContactSheet`, `renderFrameSheet`, `renderOnionSkin`: [review](review.md) |
| Save or restore work | `save`, `open`, `transaction`, `undo`, `ProjectStore`: [projects](projects.md) |
| Deliver files | `exportStoryboard`, `exportAnimaticPackage`, `exportMovie`: [export](export.md) |

## Units and identity

Positions and brush sizes use canvas units. Rotation uses radians. Pressure and opacity range from 0 to 1. Pen input timestamps use milliseconds. Animation and audio placement use integer frames, starting at frame 0.

Object names are labels; IDs identify the artwork across renames and reordering. Read methods return values for inspection. Apply changes through a handle or production operation rather than mutating a returned value and expecting it to save automatically.

## Supported workflows

Codeboard combines editable vector artwork, pixel surfaces, replayable raster strokes, layer animation, drawing substitutions, multiplane camera moves, and audio. It is a local toolkit operated through code.

Brush resource import extracts supported data; it does not reproduce another application's brush engine. Flat imported images do not acquire a rig or pose controls. Drawing substitutions do not generate in-between drawings. Codeboard does not read or write native Toon Boom project formats.

For a working starting point, use `codeboard init` and [the quickstart](quickstart.md).
