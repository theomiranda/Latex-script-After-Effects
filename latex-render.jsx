// LaTeX Renderer.jsx
// Save this script with .jsx extension in the Scripts\ScriptUI Panels folder of After Effects

(function (thisObj) {

    // Polyfill para JSON.parse e JSON.stringify
    if (typeof JSON === 'undefined') {
        JSON = {};
    }
    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (obj) {
            var t = typeof (obj);
            if (t !== "object" || obj === null) {
                // Valores simples
                if (t === "string") obj = '"' + obj.replace(/(["\\])/g, '\\$1') + '"';
                return String(obj);
            } else {
                // Objetos ou arrays
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
        // Criação do painel
        var panel = (thisObj instanceof Panel) ? thisObj : new Window('palette', 'LaTeX Renderer', undefined, { resizable: true });
        panel.orientation = 'column';
        panel.alignChildren = ['fill', 'top'];

        // Grupo para configurações
        var settingsGroup = panel.add("panel", undefined, "Configurações");
        settingsGroup.orientation = "column";
        settingsGroup.alignChildren = ["fill", "top"];
        settingsGroup.margins = 15;

        // Obter o diretório inicial do usuário
        var userHome = Folder('~').fsName;

        // Carregar as pastas favoritas do arquivo de configuração
        var favoriteFolders = loadFavoriteFolders();

        // Grupo para seleção de pasta
        var folderGroup = settingsGroup.add("group");
        folderGroup.orientation = "row";

        // Campo de texto para o caminho da pasta
        var folderPath = folderGroup.add("edittext", undefined, "");
        folderPath.size = [300, 25];

        // Botão "Procurar"
        var browseButton = folderGroup.add("button", undefined, "Procurar");

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

            var folder = Folder.selectDialog("Select folder to save images", initialFolder);

            if (folder) {
                folderPath.text = folder.fsName;
            }
        };

        // Adicionar um grupo para o menu suspenso de pastas favoritas e os botões "Salvar Pasta" e "Excluir Pasta"
        var favoriteFoldersGroup = settingsGroup.add("group");
        favoriteFoldersGroup.orientation = "row";

        favoriteFoldersGroup.add("statictext", undefined, "Favorite Folder:");
        var favoriteFoldersDropdown = favoriteFoldersGroup.add("dropdownlist", undefined, []);
        favoriteFoldersDropdown.size = [150, 25];

        // "Save Folder" button next to dropdown
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
                    favoriteFolders.splice(selectedIndex - 1, 1); // Remove favorite folder
                    saveFavoriteFolders();
                    updateFavoriteFoldersDropdown();
                    alert("Favorite folder deleted.");
                }
            } else {
                alert("Please select a favorite folder to delete.");
            }
        };

        // Function to update favorite folders dropdown
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
                var selectedFolder = favoriteFolders[selectedIndex - 1]; // Adjust index
                folderPath.text = selectedFolder.path;
            }
        };

        // Formula name field
        var formulaGroup = settingsGroup.add("group");
        formulaGroup.orientation = "row";
        formulaGroup.add("statictext", undefined, "Formula name:");
        var formulaName = formulaGroup.add("edittext", undefined, "formula");
        formulaName.size = [200, 25];

        // Grupo para seleção de resolução
        var sizeGroup = settingsGroup.add("group");
        sizeGroup.add("statictext", undefined, "Resolution:");
        var sizeDropdown = sizeGroup.add("dropdownlist", undefined, ["1x", "2x", "3x"]);
        sizeDropdown.selection = 1; // 2x as default

        // Checkbox to select import mode
        var importModeGroup = settingsGroup.add("group");
        importModeGroup.orientation = "row";
        var separateElementsCheckbox = importModeGroup.add("checkbox", undefined, "Import separate elements");

        // LaTeX Input
        var inputGroup = panel.add("panel", undefined, "LaTeX Code");
        inputGroup.orientation = "column";
        inputGroup.alignChildren = ["fill", "top"];
        inputGroup.margins = 15;

        var latexInput = inputGroup.add("edittext", undefined, "", {
            multiline: true,
            scrollable: true,
        });
        latexInput.size = [400, 150];

        // Status e botão
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
                // Update panel
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
                    // Renderizar e importar fórmula completa
                    var imageFile = renderLatexToImage(cleanLatexCode(latexCode), options, statusText);

                    if (imageFile && imageFile.exists && imageFile.length > 0) {
                        statusText.text = "Status: Importing image...";
                        // Update panel
                        if (panel instanceof Window) {
                            panel.update();
                        } else {
                            panel.layout.layout(true);
                        }

                        importImageToComp(imageFile, options.formulaName, statusText);
                        statusText.text = "Status: Completed!";
                    } else {
                        throw new Error("Error generating image. Check LaTeX code.");
                    }
                }
            } catch (e) {
                statusText.text = "Error: " + e.toString();
                alert("Error: " + e.toString());
            }
        };

        // Ajustar o layout
        panel.layout.layout(true);

        // Se for uma janela (não um painel acoplável), mostrar a janela
        if (panel instanceof Window) {
            panel.center();
            panel.show();
        }

        // Função para carregar as pastas favoritas do arquivo de configuração
        function loadFavoriteFolders() {
            var configFile = new File(Folder.userData.fullName + "/latex_renderer_favorites.json");
            var folders = [];

            if (configFile.exists) {
                try {
                    configFile.open('r');
                    var content = configFile.read();
                    configFile.close();

                    // Usar JSON.parse para interpretar o JSON
                    folders = JSON.parse(content);
                } catch (e) {
                    alert("Erro ao carregar as pastas favoritas: " + e.toString() + "\nO arquivo de configuração será redefinido.");
                    // Renomear o arquivo de configuração inválido
                    var backupFile = new File(configFile.fullName + "_backup");
                    configFile.rename(backupFile.name);
                    // Criar um novo arquivo de configuração vazio
                    folders = [];
                    saveFavoriteFolders();
                }
            } else {
                // If file doesn't exist, we can add a default folder
                folders.push({ name: "Default Folder", path: userHome });
            }

            return folders;
        }

        // Função para salvar as pastas favoritas no arquivo de configuração
        function saveFavoriteFolders() {
            var configFile = new File(Folder.userData.fullName + "/latex_renderer_favorites.json");
            try {
                configFile.open('w');
                configFile.write(JSON.stringify(favoriteFolders)); // Serializar o array em JSON
                configFile.close();
            } catch (e) {
                alert("Error saving favorite folders: " + e.toString());
            }
        }

        // Função para adicionar uma pasta favorita
        function addFavoriteFolder(path) {
            // Garantir que o path é uma string
            path = String(path);

            // Verificar se a pasta já está na lista
            for (var i = 0; i < favoriteFolders.length; i++) {
                if (favoriteFolders[i].path === path) {
                    alert("This folder is already in favorites.");
                    return;
                }
            }

            // Get folder name
            var folderName = prompt("Enter a name for the favorite folder:", "New Favorite Folder");
            if (folderName) {
                favoriteFolders.push({ name: folderName, path: path });
                saveFavoriteFolders();
            } else {
                alert("Invalid name. Folder was not added.");
            }
        }

        // Funções auxiliares

        // Função para limpar o código LaTeX
        function cleanLatexCode(code) {
            if (typeof code !== "string") {
                throw new Error("The provided LaTeX code is not a valid string.");
            }

            // Função auxiliar para escapar caracteres especiais
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

            // Remove espaços extras
            code = code.replace(/\s+/g, " ").trim();

            // Remove delimitadores como $$ ou $ no início e fim
            code = code.replace(/^\$\$|\$\$$/g, ""); // Remove $$ no início e fim
            code = code.replace(/^\$|\$$/g, "");     // Remove $ no início e fim

            // Escapar caracteres especiais
            code = escapeSpecialChars(code);

            // Substituições adicionais de símbolos
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

        // Função para renderizar o LaTeX em imagem
        function renderLatexToImage(latexCode, options, statusText) {
            latexCode = cleanLatexCode(latexCode);

            var baseUrl = "https://latex.codecogs.com/png.download?";
            var params = [];

            params.push("\\dpi{" + options.dpi + "}");
            params.push("\\bg{transparent}");
            params.push("\\large");
            params.push(latexCode);

            var fullLatex = params.join(" ");
            
            // Codificação mais robusta da URL
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

                // Executa o comando cURL
                var downloadCommand = 'curl -L -k --fail --max-time 60 -o "' + tempFile.fsName + '" "' + apiUrl + '"';
                var result = system.callSystem(downloadCommand);

                if (tempFile.exists && tempFile.length > 0) {
                    return tempFile;
                } else {
                    throw new Error("Failed to download or create PNG file.");
                }
            } catch (e) {
                statusText.text = "Error downloading image: " + e.toString();
                return null;
            }
        }

        // Função para importar a imagem na composição
        function importImageToComp(imageFile, formulaName, statusText) {
            var comp = app.project.activeItem;
            if (!(comp instanceof CompItem)) {
                throw new Error("No active composition. Open or create a composition first.");
            }

            try {
                // Importar e adicionar à composição
                var importedFile = app.project.importFile(new ImportOptions(imageFile));
                var layer = comp.layers.add(importedFile);

                // Centralizar na composição
                layer.position.setValue([comp.width / 2, comp.height / 2]);

                // Configurar escala e motion blur
                layer.property("Scale").setValue([110, 110]);
                layer.motionBlur = true;

                // Adicionar efeito de preenchimento (Fill)
                var fillEffect = layer.Effects.addProperty("ADBE Fill");
                fillEffect.property("Color").setValue([0.11, 0.11, 0.11]); // Cor escura

                // Procurar por null layer "Controle" ou "Null 1"
                var nullLayer = findNullLayer(comp);

                // Se encontrou o null layer, fazer parenting
                if (nullLayer) {
                    layer.parent = nullLayer;
                    statusText.text = "Status: Parenting completed successfully!";
                } else {
                    statusText.text = "Status: No null layer found. Layer added without parent.";
                }

                return layer;
            } catch (e) {
                throw new Error("Error importing image: " + e.toString());
            }
        }

        // Função para encontrar o null layer
        function findNullLayer(comp) {
            // Procurar por null layer "Controle" ou "Null 1"
            for (var i = 1; i <= comp.numLayers; i++) {
                var currentLayer = comp.layer(i);
                if (currentLayer.nullLayer && (currentLayer.name === "Controle" || currentLayer.name === "Null 1")) {
                    return currentLayer;
                }
            }
            return null;
        }

        // Função para renderizar e importar elementos separados
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
                // Update panel
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
                    throw new Error("Error generating image for element: " + elementCode);
                }
            }

            statusText.text = "Status: All elements have been imported!";
        }

        // Função para limpar o código LaTeX específico para o modo de split
        function cleanLatexCodeForSplit(code) {
            // Chama a função original de limpeza
            code = cleanLatexCode(code);

            // Remove \begin{align} e \end{align}
            code = code.replace(/\\begin\{align\*?\}/g, "");
            code = code.replace(/\\end\{align\*?\}/g, "");

            return code;
        }

        // Função para dividir o código LaTeX em elementos
        function splitLatexElements(latexCode) {
            // Usar uma expressão regular para dividir no 'SPLIT' ou 'split', case-insensitive
            var elements = latexCode.split(/SPLIT/i);

            // Limpar espaços em branco em cada elemento
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

    // Chamar a função para criar o painel
    var latexPanel = createLatexPanel(thisObj);

})(this);
