# UI component sources

- **ActionButton**: [Uiverse Galaxy button by 0x-Sarthak](https://github.com/uiverse-io/galaxy/blob/main/Buttons/0x-Sarthak_hungry-penguin-30.html). Adapted the pill shape, sweeping overlay, and arrow motion to MAIDAN colors; simplified animation, added disabled/focus/reduced-motion states, and made the arrow direction RTL aware. Implemented in `src/components/ui/ActionButton.tsx` and `src/styles.css`.
- **Field input state**: [Uiverse Galaxy input by Alaner-xs](https://github.com/uiverse-io/galaxy/blob/main/Inputs/Alaner-xs_red-tiger-4.html). Adapted its rounded input, border and focused state to the light MAIDAN palette; removed the dark gradient, fixed width, pointer cursor, and one-second transition. The reusable labeled `Field` keeps native validation, keyboard focus and RTL support in `src/components/ui/Field.tsx` and `src/styles.css`.
- `Card` is an original MAIDAN component based on the Stitch design, not a Uiverse component.

The Uiverse Galaxy repository licenses its elements under MIT. The original notice is retained in `licenses/UIVERSE-MIT.txt`. Attribution to the named creator is included above.
