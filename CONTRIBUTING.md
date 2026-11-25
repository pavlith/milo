# Contributing to slicer

Hey, thank you for your interest in contributing to slicer!
We're a fun project, so we won't hold your contributions to any strict standards,
but we do have some guidelines that will help us keep things organized and make it easier for you to contribute.

1. Before submitting a pull request, please make sure that your code is formatted correctly.
   We use [Prettier](https://prettier.io/) for formatting, so you can run `pnpm -C frontend format` to format your code.
2. Use CSS variables declared [here](./frontend/src/main.css) for colors and other styles (e.g. rounding),
   so that we can easily change the theme later.
3. Prefer arrow functions over regular functions, and use `const` or `let` instead of `var`.
4. Keep workbench state operations independent of UI effects. Show UI feedback in the component that calls the operation.
5. If you plan to implement a major feature, please open an issue/discussion about it first to discuss it.
   This will ensure that we're on the same page and that your work won't be wasted.
6. Workbench translations live in `frontend/src/locale/`. Add new keys to the English dictionary, which supplies the fallback for other locales.

That's it, have fun contributing! Make sure to check back periodically to see if there were any changes to these guidelines.
