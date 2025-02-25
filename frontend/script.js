document.addEventListener('DOMContentLoaded', () => {
    // Get all required elements and check if they exist
    const elements = {
        promptInput: document.getElementById('promptInput'),
        sendBtn: document.getElementById('sendBtn'),
        frameworkSelect: document.getElementById('frameworkSelect'),
        chatMessages: document.getElementById('chatMessages'),
        fileTree: document.getElementById('fileTree'),
        codeDisplay: document.getElementById('codeDisplay'),
        codeBtn: document.getElementById('codeBtn'),
        previewBtn: document.getElementById('previewBtn'),
        codeSection: document.getElementById('codeSection'),
        previewSection: document.getElementById('previewSection'),
        terminalPanel: document.getElementById('terminalPanel')
    };

    // Check if all required elements exist
    for (const [name, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`Required element "${name}" not found in the DOM`);
            return;
        }
    }

    const techSelect = document.getElementById('techSelect');
    const generateBtn = document.getElementById('generateBtn');
    const codeBtn = document.getElementById('codeBtn');
    const previewBtn = document.getElementById('previewBtn');
    const codeSection = document.getElementById('codeSection');
    const previewSection = document.getElementById('previewSection');
    const frameworkSelect = document.getElementById('frameworkSelect');
    const sendBtn = document.getElementById('sendBtn');

    let currentFiles = new Map(); // Use Map to store files by path
    let currentStructure = null;

    // Add these functions at the top level
    function addBotMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex gap-4 animate-fade-in';
        messageDiv.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-[#2A2D2E] flex items-center justify-center flex-shrink-0">
                <span class="text-sm font-medium text-[#E1E4E8]">AI</span>
            </div>
            <div class="max-w-[85%] bg-[#2A2D2E] rounded-lg px-4 py-2.5">
                <p class="text-sm text-[#E1E4E8]">${message}</p>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex gap-4 animate-fade-in';
        messageDiv.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-[#C084FC] flex items-center justify-center flex-shrink-0">
                <span class="text-sm font-medium text-white">U</span>
            </div>
            <div class="max-w-[85%] bg-[#2A2D2E] rounded-lg px-4 py-2.5">
                <p class="text-sm text-[#E1E4E8]">${message}</p>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Add typing indicator
    function showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typingIndicator';
        typingDiv.className = 'flex gap-4 animate-fade-in';
        typingDiv.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-[#2A2D2E] flex items-center justify-center flex-shrink-0">
                <span class="text-sm font-medium text-[#E1E4E8]">AI</span>
            </div>
            <div class="max-w-[85%] bg-[#2A2D2E] rounded-lg px-4 py-2.5">
                <div class="flex gap-2">
                    <div class="w-2 h-2 bg-[#4B5563] rounded-full animate-bounce"></div>
                    <div class="w-2 h-2 bg-[#4B5563] rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                    <div class="w-2 h-2 bg-[#4B5563] rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                </div>
            </div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    // Handle Generate Button Click
    generateBtn.addEventListener('click', async () => {
        const framework = frameworkSelect.value;
        const prompt = promptInput.value.trim();

        if (!prompt) {
            addBotMessage("Please enter a description of what you'd like to build.");
            return;
        }

        try {
            // Update button state
            generateBtn.disabled = true;
            frameworkSelect.disabled = true;
            generateBtn.innerHTML = `
                <svg class="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
            `;

            // Clear previous files and messages
            currentFiles.clear();
            chatMessages.innerHTML = '';
            
            // Add initial messages
            addBotMessage("Starting new project generation...");
            addUserMessage(prompt);

            const response = await fetch('http://localhost:5000/api/generate-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    techName: framework,
                    prompt: prompt
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;

                    try {
                        const jsonStr = line.slice(6);
                        const message = JSON.parse(jsonStr);
                        
                        switch (message.type) {
                            case 'start':
                                addBotMessage(`Creating a new ${framework} project based on your description...`);
                                break;

                            case 'structure':
                                addBotMessage("Project structure created. Generating code...");
                                renderFileTree(message.data);
                                break;

                            case 'code':
                                const fileData = {
                                    path: message.data.path,
                                    code: message.data.code,
                                    language: message.data.language || getLanguageFromPath(message.data.path)
                                };
                                currentFiles.set(fileData.path, fileData);
                                
                                if (currentFiles.size === 1) {
                                    displayCode(fileData);
                                }
                                break;

                            case 'complete':
                                addBotMessage("✨ Project generation complete! You can now explore the files.");
                                break;

                            case 'error':
                                addBotMessage(`❌ Error: ${message.data.error}`);
                                break;
                        }
                    } catch (error) {
                        console.error('Error parsing message:', error);
                    }
                }
            }

        } catch (error) {
            console.error('Error:', error);
            addBotMessage(`❌ Error: ${error.message}`);
        } finally {
            // Reset button state
            generateBtn.disabled = false;
            frameworkSelect.disabled = false;
            generateBtn.innerHTML = `
                <span>Generate Project</span>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                </svg>
            `;
        }
    });

    // Add this at the top of the file
    function addLanguageSupport(language) {
        if (!Prism.languages[language]) {
            const script = document.createElement('script');
            script.src = `https://cdnjs.cloudflare.com/ajax/libs/prismjs/1.24.1/components/prism-${language}.min.js`;
            document.head.appendChild(script);
        }
    }

    // Add this helper function at the top level
    function getFileIcon(extension) {
        const icons = {
            js: '📄',
            jsx: '⚛️',
            ts: '📘',
            tsx: '📗',
            css: '🎨',
            html: '🌐',
            json: '📦',
            md: '📝',
            gitignore: '👁️',
            config: '⚙️',
            default: '📄'
        };
        return icons[extension] || icons.default;
    }

    // Update the renderFileTree function to handle nested folders
    function renderFileTree(data) {
        console.log('Rendering file tree with data:', data);
        fileTree.innerHTML = '';
        currentStructure = data.structure;

        // File tree container
        const treeContainer = document.createElement('div');
        treeContainer.className = 'py-2';

        function createFileNode(fileData, indent = 0) {
            const div = document.createElement('div');
            div.className = `file-node flex items-center hover:bg-[#2A2D2E] cursor-pointer py-1.5`;
            div.style.paddingLeft = `${indent * 12 + 12}px`;
            
            // Get the full path for the file
            const fullPath = fileData.path || (fileData.name ? `todo-app/${fileData.name}` : '');
            const fileName = fullPath.split('/').pop();
            const extension = fileName.split('.').pop().toLowerCase();
            
            div.innerHTML = `
                <span class="mr-2">${getFileIcon(extension)}</span>
                <span class="text-sm text-[#E1E4E8]">${fileName}</span>
            `;

            div.onclick = () => {
                console.log('File clicked:', fullPath);
                // Try multiple ways to find the file
                let file = currentFiles.get(fullPath);
                if (!file) {
                    // Try without the project name prefix
                    const shortPath = fullPath.split('/').slice(1).join('/');
                    file = Array.from(currentFiles.values()).find(f => 
                        f.path.endsWith(shortPath) || 
                        f.path.includes(fileName)
                    );
                }
                
                if (file) {
                    console.log('Found file data:', file);
                    displayCode(file);
                    document.querySelectorAll('.file-node').forEach(el => {
                        el.classList.remove('bg-[#37373D]', 'active');
                    });
                    div.classList.add('bg-[#37373D]', 'active');
                } else {
                    console.log('No file data found for path:', fullPath);
                }
            };

            return div;
        }

        function createFolderNode(folderData, indent = 0) {
            const container = document.createElement('div');
            container.className = 'folder-container';

            const header = document.createElement('div');
            header.className = `folder-header flex items-center hover:bg-[#2A2D2E] cursor-pointer py-1.5`;
            header.style.paddingLeft = `${indent * 12 + 12}px`;

            let isExpanded = true;
            
            header.innerHTML = `
                <span class="mr-2 transform transition-transform ${isExpanded ? 'rotate-90' : ''}" style="font-size: 12px;">▶</span>
                <span class="mr-2">📁</span>
                <span class="text-sm text-[#E1E4E8]">${folderData.name}</span>
            `;

            container.appendChild(header);

            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'folder-children';
            childrenContainer.style.display = isExpanded ? 'block' : 'none';

            // Sort children: folders first, then files
            const folders = [];
            const files = [];
            
            folderData.children.forEach(child => {
                if (child.type === 'directory') {
                    folders.push(child);
                } else {
                    files.push(child);
                }
            });

            // Sort each group alphabetically
            folders.sort((a, b) => a.name.localeCompare(b.name));
            files.sort((a, b) => a.name.localeCompare(b.name));

            // Render folders first, then files
            folders.forEach(folder => {
                childrenContainer.appendChild(createFolderNode(folder, indent + 1));
            });

            files.forEach(file => {
                const fullPath = `${data.structure.name}/${folderData.name}/${file.name}`.replace(/\/+/g, '/');
                const fileNode = createFileNode({ 
                    path: fullPath,
                    name: file.name 
                }, indent + 1);
                childrenContainer.appendChild(fileNode);
            });

            header.onclick = () => {
                isExpanded = !isExpanded;
                header.querySelector('span').style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0)';
                childrenContainer.style.display = isExpanded ? 'block' : 'none';
            };

            container.appendChild(childrenContainer);
            return container;
        }

        // Create the root folder structure
        const rootFolder = createFolderNode(data.structure);
        treeContainer.appendChild(rootFolder);
        fileTree.appendChild(treeContainer);
    }

    // Update the displayCode function for better code highlighting
    function displayCode(fileData) {
        console.log('Displaying code for:', fileData);
        
        let code = fileData.code;
        if (code.startsWith('```')) {
            const matches = code.match(/```(?:\w+)?\n([\s\S]*?)```/);
            code = matches ? matches[1] : code;
        }

        const container = document.createElement('div');
        container.className = 'h-full flex flex-col';

        // Editor tabs
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'flex bg-[#252526] border-b border-[#3C3C3C] flex-shrink-0';
        
        const fileName = fileData.path.split('/').pop();
        const extension = fileName.split('.').pop().toLowerCase();
        
        tabsContainer.innerHTML = `
            <div class="editor-tab active px-4 py-2 flex items-center gap-2 bg-[#1E1E1E] border-t-2 border-[#58A6FF]">
                <span>${getFileIcon(extension)}</span>
                <span class="text-sm text-[#E1E4E8]">${fileName}</span>
            </div>
        `;

        // Code editor container with fixed width and scrolling
        const editorContainer = document.createElement('div');
        editorContainer.className = 'overflow-auto flex-1';
        editorContainer.style.height = 'calc(100vh - 236px)';

        // Code content wrapper with horizontal scroll
        const codeWrapper = document.createElement('div');
        codeWrapper.className = 'overflow-x-auto';
        codeWrapper.style.width = '100%';  // Fixed width
        
        const pre = document.createElement('pre');
        pre.className = `language-${getLanguageFromPath(fileData.path)} m-0 p-4 bg-[#1E1E1E]`;
        pre.style.minWidth = 'max-content';  // Allow content to determine width
        
        const codeElement = document.createElement('code');
        codeElement.className = `language-${getLanguageFromPath(fileData.path)} whitespace-pre`;
        codeElement.textContent = code;
        codeElement.style.fontFamily = "'JetBrains Mono', 'Fira Code', monospace";
        codeElement.style.fontSize = '14px';
        codeElement.style.lineHeight = '1.5';

        pre.appendChild(codeElement);
        codeWrapper.appendChild(pre);
        editorContainer.appendChild(codeWrapper);
        container.appendChild(tabsContainer);
        container.appendChild(editorContainer);

        codeDisplay.innerHTML = '';
        codeDisplay.appendChild(container);

        // Highlight code
        if (window.Prism) {
            Prism.highlightElement(codeElement);
        }
    }

    // Toggle between code and preview
    codeBtn.addEventListener('click', () => {
        codeBtn.classList.add('text-[#58A6FF]', 'bg-[#1E1E1E]', 'border-t-2', 'border-[#58A6FF]');
        codeBtn.classList.remove('text-[#8B949E]');
        previewBtn.classList.remove('text-[#58A6FF]', 'bg-[#1E1E1E]', 'border-t-2', 'border-[#58A6FF]');
        previewBtn.classList.add('text-[#8B949E]');
        
        codeSection.classList.remove('hidden');
        previewSection.classList.add('hidden');
    });

    previewBtn.addEventListener('click', () => {
        previewBtn.classList.add('text-[#58A6FF]', 'bg-[#1E1E1E]', 'border-t-2', 'border-[#58A6FF]');
        previewBtn.classList.remove('text-[#8B949E]');
        codeBtn.classList.remove('text-[#58A6FF]', 'bg-[#1E1E1E]', 'border-t-2', 'border-[#58A6FF]');
        codeBtn.classList.add('text-[#8B949E]');
        
        previewSection.classList.remove('hidden');
        codeSection.classList.add('hidden');
    });

    // Terminal resize functionality
    const terminalHeader = terminalPanel.querySelector('.cursor-ns-resize');
    let isResizing = false;
    let startY;
    let startHeight;

    terminalHeader.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.pageY;
        startHeight = terminalPanel.offsetHeight;
        document.body.style.cursor = 'ns-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const delta = startY - e.pageY;
        terminalPanel.style.height = `${startHeight + delta}px`;
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = '';
    });

    // Add this helper function
    function getLanguageFromPath(path) {
        const ext = path.split('.').pop().toLowerCase();
        const languageMap = {
            js: 'javascript',
            jsx: 'jsx',
            ts: 'typescript',
            tsx: 'tsx',
            css: 'css',
            scss: 'scss',
            html: 'html',
            json: 'json',
            md: 'markdown',
            gitignore: 'plaintext',
            env: 'plaintext',
            config: 'javascript'
        };
        return languageMap[ext] || 'plaintext';
    }

    // Remove old event listeners
    const oldSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(oldSendBtn, sendBtn);

    // Add new event listeners
    oldSendBtn.addEventListener('click', () => {
        console.log('Send button clicked');
        handleSendMessage();
    });

    promptInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            console.log('Enter key pressed');
            e.preventDefault();
            handleSendMessage();
        }
    });

    // Update handleSendMessage to disable framework selection
    async function handleSendMessage() {
        const prompt = promptInput.value.trim();
        const framework = frameworkSelect.value;

        if (!prompt) return;

        try {
            // Disable framework selection
            frameworkSelect.disabled = true;
            
            // Rest of your existing handleSendMessage code...
            addUserMessage(prompt);
            promptInput.value = '';
            showTypingIndicator();

            const response = await fetch('http://localhost:5000/api/generate-project', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    techName: framework,
                    prompt: prompt
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;

                    try {
                        const jsonStr = line.slice(6);
                        const message = JSON.parse(jsonStr);
                        
                        // Remove typing indicator
                        removeTypingIndicator();

                        // Handle different message types
                        switch (message.type) {
                            case 'start':
                                addBotMessage(`Creating a new ${framework} project based on your description...`);
                                break;

                            case 'structure':
                                addBotMessage("Project structure created. Generating code...");
                                renderFileTree(message.data);
                                break;

                            case 'code':
                                const fileData = {
                                    path: message.data.path,
                                    code: message.data.code,
                                    language: message.data.language || getLanguageFromPath(message.data.path)
                                };
                                currentFiles.set(fileData.path, fileData);
                                
                                if (currentFiles.size === 1) {
                                    displayCode(fileData);
                                }
                                break;

                            case 'complete':
                                addBotMessage("✨ Project generation complete! You can now explore the files.");
                                break;

                            case 'error':
                                addBotMessage(`❌ Error: ${message.data.error}`);
                                break;
                        }
                    } catch (error) {
                        console.error('Error parsing message:', error);
                    }
                }
            }

        } catch (error) {
            console.error('Request failed:', error);
            removeTypingIndicator();
            addBotMessage(`❌ Error: ${error.message}`);
            // Re-enable framework selection on error
            frameworkSelect.disabled = false;
        }
    }
}); 