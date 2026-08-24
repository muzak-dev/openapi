export default defineAppConfig({
  ui: {
    colors: {
      // The rust ramp defined in assets/css/main.css, so every Nuxt UI
      // component - the search inputs, their focus rings, any button - lands
      // on muzak.dev's orange instead of the framework's default green.
      primary: 'rust',
      // Warm grey to sit with it; the page's own surfaces are the ink and bone
      // tokens, and stone is the closest neutral ramp to them.
      neutral: 'stone',
    },
  },
})
