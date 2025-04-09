// LaTeX Renderer.jsx
// Salve este script com a extensão .jsx na pasta Scripts\ScriptUI Panels do After Effects

(function (thisObj) {
    // Polyfill para JSON.parse e JSON.stringify
    if (typeof JSON === 'undefined') {
        JSON = {};
    }
    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (obj) {
            var t = typeof (obj);
            if (t !== "object" || obj === null) {
                if (t === "string") obj = '"' + obj.replace(/(["\\])/g, '\\$1') + '"';
                return String(obj);
            } else {
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

    // Função para ambientes sem suporte a .trim()
    function myTrim(str) {
        return str.replace(/^\s+|\s+$/g, '');
    }

    // Função para obter o comando curl conforme o SO
    function getCurlPath() {
        if ($.os.toLowerCase().indexOf("windows") !== -1) {
            return "curl.exe"; 
        } else {
            return "curl";
        }
    }
    
    // Função para retornar somente o último segmento do caminho
    function getShortFolderName(path) {
        var parts;
        if (path.indexOf("\\") !== -1) {
            parts = path.split("\\");
        } else if (path.indexOf("/") !== -1) {
            parts = path.split("/");
        } else {
            parts = [path];
        }
        return parts[parts.length - 1];
    }
    
    // Funções para carregar e salvar as pastas recentes
    function loadRecentFolders() {
        var userDataFolder = Folder.userData;
        if (!userDataFolder || !userDataFolder.exists) {
            userDataFolder = Folder.myDocuments;
        }
        var recentFile = new File(userDataFolder.fullName + "/latex_renderer_recent.json");
        var recents = [];
        if (recentFile.exists) {
            try {
                recentFile.open('r');
                var content = recentFile.read();
                recentFile.close();
                recents = JSON.parse(content);
            } catch (e) {
                alert("Erro ao carregar pastas recentes: " + e.toString());
                recents = [];
                saveRecentFolders(recents);
            }
        }
        return recents;
    }

    function saveRecentFolders(recentArray) {
        var userDataFolder = Folder.userData;
        if (!userDataFolder || !userDataFolder.exists) {
            userDataFolder = Folder.myDocuments;
        }
        var recentFile = new File(userDataFolder.fullName + "/latex_renderer_recent.json");
        try {
            recentFile.open('w');
            recentFile.write(JSON.stringify(recentArray));
            recentFile.close();
        } catch (e) {
            alert("Erro ao salvar pastas recentes: " + e.toString());
        }
    }

    function createLatexPanel(thisObj) {
        var panel = (thisObj instanceof Panel) ? thisObj : new Window('palette', 'LaTeX Renderer', undefined, { resizable: true });
        panel.orientation = 'column';
        panel.alignChildren = ['fill', 'top'];

        // --- Variáveis para pastas ---
        // Array de pastas salvas (favoritas) persistidas
        var favoriteFolders = loadFavoriteFolders();
        // Array para armazenar as 3 últimas pastas usadas (recentes) – agora persistente
        var recentFolders = loadRecentFolders();

        // Grupo de configurações
        var settingsGroup = panel.add("panel", undefined, "Configurations");
        settingsGroup.orientation = "column";
        settingsGroup.alignChildren = ["fill", "top"];
        settingsGroup.margins = 15;

        // Obter diretório do usuário (fallback para Documents)
        var userDataFolder = Folder.userData;
        if (!userDataFolder || !userDataFolder.exists) {
            userDataFolder = Folder.myDocuments;
        }
        var userHome = Folder('~').fsName;

        // Grupo de seleção de pasta
        var folderGroup = settingsGroup.add("group");
        folderGroup.orientation = "row";

        var folderPath = folderGroup.add("edittext", undefined, "");
        folderPath.size = [300, 25];

        var browseButton = folderGroup.add("button", undefined, "Browse");
        browseButton.onClick = function () {
            var initialFolder = (folderPath.text !== "") ? new Folder(folderPath.text) : Folder.myDocuments;
            if (!initialFolder.exists) {
                initialFolder = Folder.myDocuments;
            }
            var folder = Folder.selectDialog("Select the folder to save images", initialFolder);
            if (folder) {
                folderPath.text = folder.fsName;
                updateRecentFolders(folder.fsName);
                updateFoldersDropdown();
            }
        };

        // Dropdown para selecionar pastas (combinando recentes + salvas)
        var foldersDropdownGroup = settingsGroup.add("group");
        foldersDropdownGroup.orientation = "row";
        foldersDropdownGroup.add("statictext", undefined, "Folder:");
        var foldersDropdown = foldersDropdownGroup.add("dropdownlist", undefined, []);
        foldersDropdown.size = [250, 25];

        // Botões para salvar ou deletar pasta dos favoritos
        var saveFavoriteButton = foldersDropdownGroup.add("button", undefined, "Save");
        saveFavoriteButton.onClick = function () {
            var pathToAdd = folderPath.text;
            if (pathToAdd !== "") {
                addFavoriteFolder(pathToAdd);
                updateFoldersDropdown();
                alert("Folder added to favorites.");
            } else {
                alert("Please select a folder first.");
            }
        };

        var deleteFavoriteButton = foldersDropdownGroup.add("button", undefined, "Delete");
        deleteFavoriteButton.onClick = function () {
            var sel = foldersDropdown.selection;
            if (sel && sel.data && sel.data.type === "favorite") {
                var confirmDelete = confirm("Delete selected favorite folder?");
                if (confirmDelete) {
                    for (var i = 0; i < favoriteFolders.length; i++) {
                        if (favoriteFolders[i].path === sel.data.path) {
                            favoriteFolders.splice(i, 1);
                            break;
                        }
                    }
                    saveFavoriteFolders();
                    updateFoldersDropdown();
                    alert("Favorite folder deleted.");
                }
            } else {
                alert("Select a favorite folder to delete.");
            }
        };

        // Atualiza a lista de pastas recentes e persiste a alteração
        function updateRecentFolders(newPath) {
            for (var i = 0; i < recentFolders.length; i++) {
                if (recentFolders[i] === newPath) {
                    recentFolders.splice(i, 1);
                    break;
                }
            }
            recentFolders.unshift(newPath);
            if (recentFolders.length > 3) {
                recentFolders.pop();
            }
            saveRecentFolders(recentFolders);
        }

        // Atualiza o dropdown combinando recentes e favoritos com novos rótulos
        function updateFoldersDropdown() {
            foldersDropdown.removeAll();
            foldersDropdown.add("item", "Select...");
            for (var i = 0; i < recentFolders.length; i++) {
                var item = foldersDropdown.add("item", "⏰ " + getShortFolderName(recentFolders[i]));
                item.data = { path: recentFolders[i], type: "recent" };
            }
            for (var j = 0; j < favoriteFolders.length; j++) {
                var favPath = favoriteFolders[j].path;
                var exists = false;
                for (var k = 0; k < recentFolders.length; k++) {
                    if (recentFolders[k] === favPath) {
                        exists = true;
                        break;
                    }
                }
                if (!exists) {
                    var itemFav = foldersDropdown.add("item", "★ " + favoriteFolders[j].name);
                    itemFav.data = { path: favPath, type: "favorite" };
                }
            }
            foldersDropdown.selection = 0;
        }
        updateFoldersDropdown();

        foldersDropdown.onChange = function () {
            if (foldersDropdown.selection && foldersDropdown.selection.data) {
                folderPath.text = foldersDropdown.selection.data.path;
            }
        };

        // Outras configurações
        var formulaGroup = settingsGroup.add("group");
        formulaGroup.orientation = "row";
        formulaGroup.add("statictext", undefined, "Formula name:");
        var formulaName = formulaGroup.add("edittext", undefined, "formula");
        formulaName.size = [200, 25];

        var sizeGroup = settingsGroup.add("group");
        sizeGroup.add("statictext", undefined, "Resolution:");
        var sizeDropdown = sizeGroup.add("dropdownlist", undefined, ["1x", "2x", "3x"]);
        sizeDropdown.selection = 1; // 2x default

        var importModeGroup = settingsGroup.add("group");
        importModeGroup.orientation = "row";
        var separateElementsCheckbox = importModeGroup.add("checkbox", undefined, "Import separate elements");

        var inputGroup = panel.add("panel", undefined, "LaTeX Code");
        inputGroup.orientation = "column";
        inputGroup.alignChildren = ["fill", "top"];
        inputGroup.margins = 15;

        var latexInput = inputGroup.add("edittext", undefined, "", { multiline: true, scrollable: true });
        latexInput.size = [400, 150];

        var statusText = panel.add("statictext", undefined, "Status: Ready");
        statusText.alignment = ["fill", "top"];

        var generateButton = panel.add("button", undefined, "Generate Image");
        generateButton.onClick = function () {
            if (!folderPath.text || !formulaName.text) {
                alert("Select a destination folder and enter a formula name.");
                return;
            }
            try {
                statusText.text = "Status: Generating image...";
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
                    renderAndImportSeparateElements(latexCode, options, statusText, panel);
                } else {
                    var imageFile = renderLatexToImage(latexCode, options, statusText);
                    if (imageFile && imageFile.exists && imageFile.length > 0) {
                        statusText.text = "Status: Importing image...";
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

        panel.layout.layout(true);
        if (panel instanceof Window) {
            panel.center();
            panel.show();
        }

        // --- Funções de favoritos (mantidas) ---
        function loadFavoriteFolders() {
            var userDataFolder = Folder.userData;
            if (!userDataFolder || !userDataFolder.exists) {
                userDataFolder = Folder.myDocuments;
            }
            var configFile = new File(userDataFolder.fullName + "/latex_renderer_favorites.json");
            var folders = [];
            if (configFile.exists) {
                try {
                    configFile.open('r');
                    var content = configFile.read();
                    configFile.close();
                    folders = JSON.parse(content);
                } catch (e) {
                    alert("Error loading favorites: " + e.toString() + "\nConfiguration will be reset.");
                    var backupFile = new File(configFile.fullName + "_backup");
                    configFile.rename(backupFile.name);
                    folders = [];
                    saveFavoriteFolders();
                }
            } else {
                folders.push({ name: "Default Folder", path: userHome });
            }
            return folders;
        }

        function saveFavoriteFolders() {
            var userDataFolder = Folder.userData;
            if (!userDataFolder || !userDataFolder.exists) {
                userDataFolder = Folder.myDocuments;
            }
            var configFile = new File(userDataFolder.fullName + "/latex_renderer_favorites.json");
            try {
                configFile.open('w');
                configFile.write(JSON.stringify(favoriteFolders));
                configFile.close();
            } catch (e) {
                alert("Error saving favorites: " + e.toString());
            }
        }

        function addFavoriteFolder(path) {
            path = String(path);
            for (var i = 0; i < favoriteFolders.length; i++) {
                if (favoriteFolders[i].path === path) {
                    alert("Folder already in favorites.");
                    return;
                }
            }
            var folderName = prompt("Enter a name for the favorite folder:", "New Favorite Folder");
            if (folderName) {
                favoriteFolders.push({ name: folderName, path: path });
                saveFavoriteFolders();
            } else {
                alert("Invalid name. Folder not added.");
            }
        }

        // --- Funções de limpeza e renderização (mantidas) ---
        function cleanLatexCode(code) {
            if (typeof code !== "string") {
                throw new Error("Provided LaTeX code is not a valid string.");
            }
            code = code.replace(/\s+/g, " ");
            code = code.replace(/^\s+|\s+$/g, "");
            // Alteração na função de escape para preservar \& já existentes
            function escapeSpecialChars(str) {
                // Substitui temporariamente \& para não duplicar a escape
                str = str.replace(/\\&/g, "__AMP__");
                var specialChars = {
                    'á': '{\\\'a}', 'à': '{\\`a}', 'ã': '{\\~a}', 'â': '{\\^a}',
                    'é': '{\\\'e}', 'ê': '{\\^e}', 'í': '{\\\'i}', 'ó': '{\\\'o}',
                    'õ': '{\\~o}', 'ô': '{\\^o}', 'ú': '{\\\'u}', 'ü': '{\\\\"u}',
                    'ç': '{\\c{c}}', 'Á': '{\\\'A}', 'À': '{\\`A}', 'Ã': '{\\~A}',
                    'Â': '{\\^A}', 'É': '{\\\'E}', 'Ê': '{\\^E}', 'Í': '{\\\'I}',
                    'Ó': '{\\\'O}', 'Õ': '{\\~O}', 'Ô': '{\\^O}', 'Ú': '{\\\'U}',
                    'Ü': '{\\\\"U}', 'Ç': '{\\c{C}}', '$': '\\$', 'º': '\\textsuperscript{o}',
                    '&': '\\&'
                };
                str = str.replace(/[áàãâéêíóõôúüçÁÀÃÂÉÊÍÓÕÔÚÜÇ$º&]/g, function(match) {
                    return specialChars[match] || match;
                });
                // Restaura os \& originais
                str = str.replace(/__AMP__/g, "\\&");
                return str;
            }
            code = escapeSpecialChars(code);
            var symbolReplacements = {
                '≅': '\\approx', '≠': '\\neq', '≤': '\\leq', '≥': '\\geq',
                '×': '\\times', '÷': '\\div', '→': '\\rightarrow',
                '←': '\\leftarrow', '↔': '\\leftrightarrow', '∞': '\\infty',
                '±': '\\pm', '∓': '\\mp', '∈': '\\in', '∉': '\\notin',
                '⊂': '\\subset', '⊆': '\\subseteq', '∪': '\\cup',
                '∩': '\\cap', '∅': '\\emptyset'
            };
            for (var symbol in symbolReplacements) {
                code = code.replace(new RegExp(symbol, 'g'), symbolReplacements[symbol]);
            }
            return code;
        }

        function renderLatexToImage(latexCode, options, statusText) {
            latexCode = cleanLatexCode(latexCode);
            var baseUrl = "https://latex.codecogs.com/png.download?";
            var params = [];
            params.push("\\dpi{" + options.dpi + "}");
            params.push("\\bg{transparent}");
            params.push("\\large");
            params.push(latexCode);
            var fullLatex = params.join(" ");
            var apiUrl = baseUrl + encodeURIComponent(fullLatex)
                .replace(/'/g, "%27")
                .replace(/\(/g, "%28")
                .replace(/\)/g, "%29")
                .replace(/\*/g, "%2A")
                .replace(/!/g, "%21")
                .replace(/~/g, "%7E")
                .replace(/&/g, "%26");
            $.writeln("API URL: " + apiUrl);
            try {
                var outputFolder = new Folder(options.outputFolder);
                if (!outputFolder.exists) {
                    outputFolder.create();
                }
                var timestamp = new Date().getTime();
                var tempFile = new File(outputFolder.fullName + "/" + options.formulaName + "_" + timestamp + ".png");
                var curlPath = getCurlPath();
                var downloadCommand = curlPath + " -L -k --fail --max-time 60 -o \"" + tempFile.fsName + "\" \"" + apiUrl + "\"";
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

        function importImageToComp(imageFile, formulaName, statusText) {
            var comp = app.project.activeItem;
            if (!(comp instanceof CompItem)) {
                throw new Error("No active composition. Open or create one first.");
            }
            try {
                var importedFile = app.project.importFile(new ImportOptions(imageFile));
                var layer = comp.layers.add(importedFile);
                layer.position.setValue([comp.width / 2, comp.height / 2]);
                layer.property("Scale").setValue([110, 110]);
                layer.motionBlur = true;
                var fillEffect = layer.Effects.addProperty("ADBE Fill");
                fillEffect.property("Color").setValue([0.11, 0.11, 0.11]);
                var nullLayer = findNullLayer(comp);
                if (nullLayer) {
                    layer.parent = nullLayer;
                    statusText.text = "Status: Parenting successful!";
                } else {
                    statusText.text = "Status: No null layer found. Layer added without parenting.";
                }
                return layer;
            } catch (e) {
                throw new Error("Error importing image: " + e.toString());
            }
        }

        function findNullLayer(comp) {
            for (var i = 1; i <= comp.numLayers; i++) {
                var currentLayer = comp.layer(i);
                if (currentLayer.nullLayer && (currentLayer.name === "Control" || currentLayer.name === "Null 1")) {
                    return currentLayer;
                }
            }
            return null;
        }

        function renderAndImportSeparateElements(latexCode, options, statusText, panel) {
            var elements = splitLatexElements(latexCode);
            var outputFolder = new Folder(options.outputFolder);
            if (!outputFolder.exists) {
                outputFolder.create();
            }
            for (var i = 0; i < elements.length; i++) {
                var elementCode = elements[i];
                var elementName = options.formulaName + "_element_" + (i + 1);
                statusText.text = "Status: Rendering element " + (i + 1) + " of " + elements.length;
                if (panel instanceof Window) {
                    panel.update();
                } else {
                    panel.layout.layout(true);
                }
                var elementOptions = { dpi: options.dpi, outputFolder: options.outputFolder, formulaName: elementName };
                var imageFile = renderLatexToImage(cleanLatexCodeForSplit(elementCode), elementOptions, statusText);
                if (imageFile && imageFile.exists && imageFile.length > 0) {
                    importImageToComp(imageFile, elementName, statusText);
                } else {
                    throw new Error("Error generating image for element: " + elementCode);
                }
            }
            statusText.text = "Status: All elements imported!";
        }

        function cleanLatexCodeForSplit(code) {
            code = cleanLatexCode(code);
            code = code.replace(/\\begin\{align\*?\}/g, "");
            code = code.replace(/\\end\{align\*?\}/g, "");
            code = code.replace(/\\begin\{gather\*?\}/g, "");
            code = code.replace(/\\end\{gather\*?\}/g, "");
            return code;
        }

        function splitLatexElements(latexCode) {
            var elements = latexCode.split(/SPLIT/i);
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

    var latexPanel = createLatexPanel(thisObj);
})(this);
