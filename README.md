LaTeX Renderer for Adobe After Effects

This repository contains a script for Adobe After Effects to render LaTeX equations as images. It provides features to import the rendered formulas or individual elements into your composition.

Features

- Render LaTeX equations as images directly in After Effects.
- Import elements either as a whole formula or split them into parts.
- Manage favorite folders for easy access to frequently used directories.
- User-friendly ScriptUI Panel for convenient control.

Installation

1. Save the script file with the `.jsx` extension.
2. Move the script to the `Scripts\ScriptUI Panels` folder in the Adobe After Effects installation directory.
3. Restart After Effects if it was open.
4. Open the script from the **Window** menu inside After Effects.

Usage

- Choose the folder where you want to save the images.
- Enter your LaTeX code into the provided field.
- Set the desired resolution (`1x`, `2x`, `3x`) for the output.
- Click **Generate Image** to render your equation.

Prerequisites

- Adobe After Effects
- Internet Connection: The script uses an online LaTeX rendering API to create the images.

JSON Polyfills

This script includes polyfills for `JSON.parse` and `JSON.stringify` to ensure compatibility with different versions of After Effects.

License

This script is released under the MIT License. Feel free to use, modify, and collaborate.

Contributing

Contributions are welcome! Please create a pull request or raise an issue if you encounter any bugs or have suggestions.

Acknowledgements

- LaTeX rendering is handled using the [CodeCogs API](https://latex.codecogs.com).

Contact

For questions or suggestions, feel free to open an issue on GitHub.
