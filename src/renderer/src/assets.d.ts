/** An asset Vite inlines as its text (`?raw`): an icon's SVG, whose shape a component draws itself (`svgPathOf`). */
declare module '*.svg?raw' {
  const text: string;
  export default text;
}
