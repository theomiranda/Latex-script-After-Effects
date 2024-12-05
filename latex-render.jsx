// LaTeX Renderer.jsx
// Save this script with the .jsx extension in the Scripts\ScriptUI Panels folder of After Effects

(function (thisObj) {
    // Polyfill for JSON.parse and JSON.stringify
    if (typeof JSON === 'undefined') {
        JSON = {};
    }
    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (obj) {
            var t = typeof (obj);
            if (t !== "object" || obj === null) {
                // Simple values
                if (t === "string") obj = '"' + obj.replace(/(["\\])/g, '\\$1') + '"';
                return String(obj);
            } else {
                // Objects or arrays
                var json = [], isArray = (obj && obj.constructor === Array);
                for (var n in obj) {
                    var v = obj[n];
                    t = typeof (v);
                    if (t === "string") {
                        v = '"' + v.replace(/(["\\])/g, '\\$1') + '"';
                    } else if (t === "object" && v !== null) {
                        v = JSON.stringify(v);
                    }
                    json.push((isArray ? "" : '"' + n + '":') + String(v));
                }
                return (isArray ? "[" : "{") + String(json) + (isArray ? "]" : "}");
            }
        };
    }
    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (s) {
            return eval('(' + s + ')');
        };
    }

    function createLatexPanel(thisObj) {
        // Panel creation
        var panel = (thisObj instanceof Panel) ? thisObj : new Window('palette', 'LaTeX Renderer', undefined, { resizable: true });
        panel.orientation = 'column';
        panel.alignChildren = ['fill', 'top'];

        // Configuration group
        var settingsGroup = panel.add("panel", undefined, "Configurations");
        settingsGroup.orientation = "column";
        settingsGroup.alignChildren = ["fill", "top"];
        settingsGroup.margins = 15;

        // Get user's home directory
        var userHome = Folder('~').fsName;

        // Load favorite folders from configuration file
        var favoriteFolders = loadFavoriteFolders();

        // Folder selection group
        var folderGroup = settingsGroup.add("group");
        folderGroup.orientation = "row";

        // Text field for folder path
        var folderPath = folderGroup.add("edittext", undefined, "");
        folderPath.size = [300, 25];

        // "Browse" button
        var browseButton = folderGroup.add("button", undefined, "Browse");

        browseButton.onClick = function () {
            var initialFolder;
            if (folderPath.text !== "") {
                initialFolder = new Folder(folderPath.text);
            } else {
                initialFolder = Folder.myDocuments;
            }

            if (!initialFolder.exists) {
                initialFolder = Folder.myDocuments;
            }

            var folder = Folder.selectDialog("Select the folder to save images", initialFolder);

            if (folder) {
                folderPath.text = folder.fsName;
            }
        };

        // Add a group for the favorite folders dropdown and "Save Folder" and "Delete Folder" buttons
        var favoriteFoldersGroup = settingsGroup.add("group");
        favoriteFoldersGroup.orientation = "row";

        favoriteFoldersGroup.add("statictext", undefined, "Favorite Folder:");
        var favoriteFoldersDropdown = favoriteFoldersGroup.add("dropdownlist", undefined, []);
        favoriteFoldersDropdown.size = [150, 25];

        // "Save Folder" button next to the dropdown
        var saveFavoriteButton = favoriteFoldersGroup.add("button", undefined, "Save Folder");

        saveFavoriteButton.onClick = function () {
            var pathToAdd = folderPath.text;
            if (pathToAdd !== "") {
                addFavoriteFolder(pathToAdd);
                updateFavoriteFoldersDropdown();
                alert("Folder added to favorites.");
            } else {
                alert("Please select a folder before adding it to favorites.");
            }
        };

        // "Delete Folder" button
        var deleteFavoriteButton = favoriteFoldersGroup.add("button", undefined, "Delete Folder");

        deleteFavoriteButton.onClick = function () {
            var selectedIndex = favoriteFoldersDropdown.selection ? favoriteFoldersDropdown.selection.index : 0;
            if (selectedIndex > 0) {
                var confirmDelete = confirm("Are you sure you want to delete the selected favorite folder?");
                if (confirmDelete) {
                    favoriteFolders.splice(selectedIndex - 1, 1); // Remove the favorite folder
                    saveFavoriteFolders();
                    updateFavoriteFoldersDropdown();
                    alert("Favorite folder deleted.");
                }
            } else {
                alert("Please select a favorite folder to delete.");
            }
        };

        // Function to update the favorite folders dropdown
        function updateFavoriteFoldersDropdown() {
            favoriteFoldersDropdown.removeAll();
            favoriteFoldersDropdown.add("item", "Select...");
            for (var i = 0; i < favoriteFolders.length; i++) {
                favoriteFoldersDropdown.add("item", favoriteFolders[i].name);
            }
            favoriteFoldersDropdown.selection = 0;
        }

        updateFavoriteFoldersDropdown();

        favoriteFoldersDropdown.onChange = function () {
            var selectedIndex = favoriteFoldersDropdown.selection.index;
            if (selectedIndex > 0) {
                var selectedFolder = favoriteFolders[selectedIndex - 1]; // Adjust the index
                folderPath.text = selectedFolder.path;
            }
        };

        // Field for formula name
        var formulaGroup = settingsGroup.add("group");
        formulaGroup.orientation = "row";
        formulaGroup.add("statictext", undefined, "Formula name:");
        var formulaName = formulaGroup.add("edittext", undefined, "formula");
        formulaName.size = [200, 25];

        // Size selection group
        var sizeGroup = settingsGroup.add("group");
        sizeGroup.add("statictext", undefined, "Resolution:");
        var sizeDropdown = sizeGroup.add("dropdownlist", undefined, ["1x", "2x", "3x"]);
        sizeDropdown.selection = 1; // 2x default

        // Checkbox for import mode
        var importModeGroup = settingsGroup.add("group");
        importModeGroup.orientation = "row";
        var separateElementsCheckbox = importModeGroup.add("checkbox", undefined, "Import separate elements");

        // LaTeX input
        var inputGroup = panel.add("panel", undefined, "LaTeX Code");
        inputGroup.orientation = "column";
        inputGroup.alignChildren = ["fill", "top"];
        inputGroup.margins = 15;

        var latexInput = inputGroup.add("edittext", undefined, "", {
            multiline: true,
            scrollable: true,
        });
        latexInput.size = [400, 150];

        // Status and button
        var statusText = panel.add("statictext", undefined, "Status: Ready");
        statusText.alignment = ["fill", "top"];

        var generateButton = panel.add("button", undefined, "Generate Image");
        generateButton.onClick = function () {
            if (!folderPath.text || !formulaName.text) {
                alert("Please select a destination folder and enter a formula name.");
                return;
            }

            try {
                statusText.text = "Status: Generating image...";
                // Update the panel
                if (panel instanceof Window) {
                    panel.update();
                } else {
                    panel.layout.layout(true);
                }

                var dpiOptions = { 0: "300", 1: "600", 2: "1200" };
                var selectedDPI = dpiOptions[sizeDropdown.selection.index];

                var options = {
                    dpi: selectedDPI,
                    outputFolder: folderPath.text,
                    formulaName: formulaName.text,
                    separateElements: separateElementsCheckbox.value
                };

                var latexCode = latexInput.text || "";

                if (options.separateElements) {
                    // Render and import separate elements
                    renderAndImportSeparateElements(latexCode, options, statusText, panel);
                } else {
                    // Render and import complete formula
                    var imageFile = renderLatexToImage(latexCode, options, statusText);

                    if (imageFile && imageFile.exists && imageFile.length > 0) {
                        statusText.text = "Status: Importing image...";
                        // Update the panel
                        if (panel instanceof Window) {
                            panel.update();
                        } else {
                            panel.layout.layout(true);
                        }

                        importImageToComp(imageFile, options.formulaName, statusText);
                        statusText.text = "Status: Completed!";
                    } else {
                        throw new Error("Error generating the image. Check the LaTeX code.");
                    }
                }
            } catch (e) {
                statusText.text = "Error: " + e.toString();
                alert("Error: " + e.toString());
            }
        };

        // Adjust layout
        panel.layout.layout(true);

        // If it is a window (not a dockable panel), show the window
        if (panel instanceof Window) {
            panel.center();
            panel.show();
        }

        // Function to load favorite folders from the configuration file
        function loadFavoriteFolders() {
            var configFile = new File(Folder.userData.fullName + "/latex_renderer_favorites.json");
            var folders = [];

            if (configFile.exists) {
                try {
                    configFile.open('r');
                    var content = configFile.read();
                    configFile.close();

                    // Use JSON.parse to interpret the JSON
                    folders = JSON.parse(content);
                } catch (e) {
                    alert("Error loading favorite folders: " + e.toString() + "\nThe configuration file will be reset.");
                    // Rename the invalid configuration file
                    var backupFile = new File(configFile.fullName + "_backup");
                    configFile.rename(backupFile.name);
                    // Create a new empty configuration file
                    folders = [];
                    saveFavoriteFolders();
                }
            } else {
                // If the file does not exist, we can add a default folder
                folders.push({ name: "Default Folder", path: userHome });
            }

            return folders;
        }

        // Function to save favorite folders to the configuration file
        function saveFavoriteFolders() {
            var configFile = new File(Folder.userData.fullName + "/latex_renderer_favorites.json");
            try {
                configFile.open('w');
                configFile.write(JSON.stringify(favoriteFolders)); // Serialize the array to JSON
                configFile.close();
            } catch (e) {
                alert("Error saving favorite folders: " + e.toString());
            }
        }

        // Function to add a favorite folder
        function addFavoriteFolder(path) {
            // Ensure the path is a string
            path = String(path);

            // Check if the folder is already in the list
            for (var i = 0; i < favoriteFolders.length; i++) {
                if (favoriteFolders[i].path === path) {
                    alert("This folder is already in favorites.");
                    return;
                }
            }

            // Get the folder name
            var folderName = prompt("Enter a name for the favorite folder:", "New Favorite Folder");
            if (folderName) {
                favoriteFolders.push({ name: folderName, path: path });
                saveFavoriteFolders();
            } else {
                alert("Invalid name. The folder was not added.");
            }
        }

        // Helper functions

        // Function to clean LaTeX code
        function cleanLatexCode(code) {
            if (typeof code !== "string") {
                throw new Error("The provided LaTeX code is not a valid string.");
            }

            // Helper function to escape special characters
            function escapeSpecialChars(str) {
                var specialChars = {
                    'á': '{\\\'a}',
                    'à': '{\\\`a}',
                    'ã': '{\\\~a}',
                    'â': '{\\\^a}',
                    'é': '{\\\'e}',
                    'ê': '{\\\^e}',
                    'í': '{\\\'i}',
                    'ó': '{\\\'o}',
                    'õ': '{\\\~o}',
                    'ô': '{\\\^o}',
                    'ú': '{\\\'u}',
                    'ü': '{\\\\"u}',
                    'ç': '{\\c{c}}',
                    'Á': '{\\\'A}',
                    'À': '{\\\`A}',
                    'Ã': '{\\\~A}',
                    'Â': '{\\\^A}',
                    'É': '{\\\'E}',
                    'Ê': '{\\\^E}',
                    'Í': '{\\\'I}',
                    'Ó': '{\\\'O}',
                    'Õ': '{\\\~O}',
                    'Ô': '{\\\^O}',
                    'Ú': '{\\\'U}',
                    'Ü': '{\\\\"U}',
                    'Ç': '{\\c{C}}',
                    '$': '\\$'
                };
                
                return str.replace(/[áàãâéêíóõôúüçÁÀÃÂÉÊÍÓÕÔÚÜÇ$]/g, function(match) {
                    return specialChars[match] || match;
                });
            }

            // Remove extra spaces
            code = code.replace(/\s+/g, " ").trim();

            // Remove delimiters like $$ or $ at the beginning and end
            code = code.replace(/^\$\$|\$\$$/g, ""); // Remove $$ at the beginning and end
            code = code.replace(/^\$|\$$/g, "");     // Remove $ at the beginning and end

            // Escape special characters
            code = escapeSpecialChars(code);

            // Additional symbol replacements
            var symbolReplacements = {
                '≅': '\\approx',
                '≠': '\\neq',
                '≤': '\\leq',
                '≥': '\\geq',
                '×': '\\times',
                '÷': '\\div',
                '→': '\\rightarrow',
                '←': '\\leftarrow',
                '↔': '\\leftrightarrow',
                '∞': '\\infty',
                '±': '\\pm',
                '∓': '\\mp',
                '∈': '\\in',
                '∉': '\\notin',
                '⊂': '\\subset',
                '⊆': '\\subseteq',
                '∪': '\\cup',
                '∩': '\\cap',
                '∅': '\\emptyset'
            };
            
            for (var symbol in symbolReplacements) {
                code = code.replace(new RegExp(symbol, 'g'), symbolReplacements[symbol]);
            }

            return code;
        }

        // Function to render LaTeX to image
        function renderLatexToImage(latexCode, options, statusText) {
            latexCode = cleanLatexCode(latexCode);

            var baseUrl = "https://latex.codecogs.com/png.download?";
            var params = [];

            params.push("\\dpi{" + options.dpi + "}");
            params.push("\\bg{transparent}");
            params.push("\\large");
            params.push(latexCode);

            var fullLatex = params.join(" ");
            
            // More robust URL encoding
            var apiUrl = baseUrl + encodeURIComponent(fullLatex)
                .replace(/'/g, "%27")
                .replace(/\(/g, "%28")
                .replace(/\)/g, "%29")
                .replace(/\*/g, "%2A")
                .replace(/!/g, "%21")
                .replace(/~/g, "%7E");

            try {
                var outputFolder = new Folder(options.outputFolder);
                if (!outputFolder.exists) {
                    outputFolder.create();
                }

                var timestamp = new Date().getTime();
                var tempFile = new File(outputFolder.fullName + "/" + options.formulaName + "_" + timestamp + ".png");

                // Execute the cURL command
                var downloadCommand = 'curl -L -k --fail --max-time 60 -o "' + tempFile.fsName + '" "' + apiUrl + '"';
                var result = system.callSystem(downloadCommand);

                if (tempFile.exists && tempFile.length > 0) {
                    return tempFile;
                } else {
                    throw new Error("Failed to download or create the PNG file.");
                }
            } catch (e) {
                statusText.text = "Error downloading image: " + e.toString();
                return null;
            }
        }

        // Function to import the image into the composition
        function importImageToComp(imageFile, formulaName, statusText) {
            var comp = app.project.activeItem;
            if (!(comp instanceof CompItem)) {
                throw new Error("No active composition. Open or create a composition first.");
            }

            try {
                // Import and add to the composition
                var importedFile = app.project.importFile(new ImportOptions(imageFile));
                var layer = comp.layers.add(importedFile);

                // Center in the composition
                layer.position.setValue([comp.width / 2, comp.height / 2]);

                // Configure scale and motion blur
                layer.property("Scale").setValue([110, 110]);
                layer.motionBlur = true;

                // Add Fill effect
                var fillEffect = layer.Effects.addProperty("ADBE Fill");
                fillEffect.property("Color").setValue([0.11, 0.11, 0.11]); // Dark color

                // Look for "Control" or "Null 1" null layer
                var nullLayer = findNullLayer(comp);

                // If a null layer is found, parent it
                if (nullLayer) {
                    layer.parent = nullLayer;
                    statusText.text = "Status: Parenting successful!";
                } else {
                    statusText.text = "Status: No null layer found. The layer was added without parenting.";
                }

                return layer;
            } catch (e) {
                throw new Error("Error importing image: " + e.toString());
            }
        }

        // Function to find the null layer
        function findNullLayer(comp) {
            // Look for "Control" or "Null 1" null layer
            for (var i = 1; i <= comp.numLayers; i++) {
                var currentLayer = comp.layer(i);
                if (currentLayer.nullLayer && (currentLayer.name === "Control" || currentLayer.name === "Null 1")) {
                    return currentLayer;
                }
            }
            return null;
        }

        // Function to render and import separate elements
        function renderAndImportSeparateElements(latexCode, options, statusText, panel) {
            var elements = splitLatexElements(latexCode);
            var layers = [];
            var outputFolder = new Folder(options.outputFolder);

            if (!outputFolder.exists) {
                outputFolder.create();
            }

            for (var i = 0; i < elements.length; i++) {
                var elementCode = elements[i];
                var elementName = options.formulaName + "_element_" + (i + 1);

                statusText.text = "Status: Rendering element " + (i + 1) + " of " + elements.length;
                // Update the panel
                if (panel instanceof Window) {
                    panel.update();
                } else {
                    panel.layout.layout(true);
                }

                var elementOptions = {
                    dpi: options.dpi,
                    outputFolder: options.outputFolder,
                    formulaName: elementName
                };

                var imageFile = renderLatexToImage(cleanLatexCodeForSplit(elementCode), elementOptions, statusText);

                if (imageFile && imageFile.exists && imageFile.length > 0) {
                    importImageToComp(imageFile, elementName, statusText);
                } else {
                    throw new Error("Error generating the image for element: " + elementCode);
                }
            }

            statusText.text = "Status: All elements were imported!";
        }

        // Function to clean LaTeX code specifically for split mode
        function cleanLatexCodeForSplit(code) {
            // Call the original cleaning function
            code = cleanLatexCode(code);

            // Remove \begin{align} and \end{align}
            code = code.replace(/\\begin\{align\*?\}/g, "");
            code = code.replace(/\\end\{align\*?\}/g, "");

            return code;
        }

        // Function to split LaTeX code into elements
        function splitLatexElements(latexCode) {
            // Use a regex to split on 'SPLIT' or 'split', case-insensitive
            var elements = latexCode.split(/SPLIT/i);

            // Clean up whitespace in each element
            var cleanedElements = [];
            for (var i = 0; i < elements.length; i++) {
                var elem = elements[i].replace(/^\s+|\s+$/g, '');
                if (elem !== '') {
                    cleanedElements.push(elem);
                }
            }

            return cleanedElements;
        }
    }

    // Call the function to create the panel
    var latexPanel = createLatexPanel(thisObj);

})(this);
