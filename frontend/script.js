import { daytonaService } from './daytonaService.js';

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
            document.body.innerHTML = `
                <div class="p-4 bg-red-100 text-red-700">
                    Error: Required element "${name}" not found. Please check the console for details.
                </div>
            `;
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

    let currentSession = {
        projectType: null,  // 'none', 'react', etc.
        files: new Map(),   // Current files
        structure: null,    // Project structure
        lastPrompt: '',     // Last prompt for context
        isInitialized: false // Whether first generation is done
    };

    // Add these functions at the top level
    function addBotMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex gap-4 justify-start animate-fade-in';
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
        messageDiv.className = 'flex gap-4 justify-end animate-fade-in';
        messageDiv.innerHTML = `
            <div class="max-w-[85%] bg-[#2B5278] rounded-lg px-4 py-2.5">
                <p class="text-sm text-[#E1E4E8]">${message}</p>
            </div>
            <div class="w-8 h-8 rounded-full bg-[#C084FC] flex items-center justify-center flex-shrink-0">
                <span class="text-sm font-medium text-white">U</span>
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
        try {
            console.log('Generate button clicked');
            
            // Check if already generating
            if (generateBtn.disabled) {
                console.log('Generation already in progress');
                return;
            }

            const framework = frameworkSelect.value;
            const prompt = promptInput.value.trim();

            if (!prompt) {
                console.log('No prompt provided');
                addBotMessage("Please enter a description of what you'd like to build.");
                return;
            }

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
            currentSession.files.clear();
            chatMessages.innerHTML = '';
            
            // Add initial messages
            addBotMessage("Starting new project generation...");
            addUserMessage(prompt);

            console.log('Making API request with:', {
                techName: framework,
                prompt: prompt
            });

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
                throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
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
                        console.log('Received message:', jsonStr);
                        const message = JSON.parse(jsonStr);
                        
                        switch (message.type) {
                            case 'start':
                                addBotMessage(`Creating a new ${framework} project based on your description...`);
                                break;

                            case 'structure':
                                console.log('Rendering file structure:', message.data);
                                addBotMessage("Project structure created. Generating code...");
                                renderFileTree(message.data);
                                break;

                            case 'code':
                                const fileData = {
                                    path: message.data.path,
                                    code: message.data.code,
                                    language: message.data.language || getLanguageFromPath(message.data.path)
                                };
                                console.log('Adding file:', fileData.path);
                                currentSession.files.set(fileData.path, fileData);
                                
                                if (currentSession.files.size === 1) {
                                    displayCode(fileData);
                                }
                                break;

                            case 'complete':
                                addBotMessage("✨ Project generation complete! You can now explore the files.");
                                break;

                            case 'error':
                                console.error('Generation error:', message.data.error);
                                addBotMessage(`❌ Error: ${message.data.error}`);
                                break;
                        }
                    } catch (error) {
                        console.error('Error parsing message:', error, 'Message:', line);
                    }
                }
            }

            // After successful generation
            currentSession.isInitialized = true;
            currentSession.projectType = framework;
            currentSession.lastPrompt = prompt;
            
            // Update generate button permanently
            generateBtn.disabled = true;
            generateBtn.classList.add('opacity-50', 'cursor-not-allowed');
            generateBtn.innerHTML = `
                <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                Project Generated
            `;
            
            // Disable framework select
            frameworkSelect.disabled = true;
            
            // Update prompt placeholder
            promptInput.placeholder = "Describe the changes you want to make...";

        } catch (error) {
            console.error('Generation error:', error);
            addBotMessage(`❌ Error: ${error.message}`);
            
            // Reset button state on error
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
        currentSession.structure = data.structure;

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
                let file = currentSession.files.get(fullPath);
                if (!file) {
                    // Try without the project name prefix
                    const shortPath = fullPath.split('/').slice(1).join('/');
                    file = Array.from(currentSession.files.values()).find(f => 
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

        // Editor tabs with copy button
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'flex bg-[#252526] border-b border-[#3C3C3C] flex-shrink-0 justify-between items-center pr-2';
        
        const fileName = fileData.path.split('/').pop();
        const extension = fileName.split('.').pop().toLowerCase();
        
        // Left side - file name
        const fileTab = document.createElement('div');
        fileTab.className = 'editor-tab active px-4 py-2 flex items-center gap-2 bg-[#1E1E1E] border-t-2 border-[#58A6FF]';
        fileTab.innerHTML = `
            <span>${getFileIcon(extension)}</span>
            <span class="text-sm text-[#E1E4E8]">${fileName}</span>
        `;

        // Right side - copy button
        const copyButton = document.createElement('button');
        copyButton.className = 'text-[#E1E4E8] hover:bg-[#2A2D2E] p-1.5 rounded flex items-center gap-2 text-sm transition-colors';
        copyButton.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
            </svg>
            <span>Copy</span>
        `;

        // Add click handler for copy button
        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(code);
                copyButton.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                    </svg>
                    <span>Copied!</span>
                `;
                copyButton.classList.add('text-green-400');
                
                // Reset button after 2 seconds
                setTimeout(() => {
                    copyButton.innerHTML = `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                        </svg>
                        <span>Copy</span>
                    `;
                    copyButton.classList.remove('text-green-400');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });

        tabsContainer.appendChild(fileTab);
        tabsContainer.appendChild(copyButton);

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

    // Update the tab switching logic
    function switchToPreview(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        try {
            // Update button states
            previewBtn.classList.add('text-[#58A6FF]', 'bg-[#1E1E1E]', 'border-t-2', 'border-[#58A6FF]');
            previewBtn.classList.remove('text-[#8B949E]');
            
            codeBtn.classList.remove('text-[#58A6FF]', 'bg-[#1E1E1E]', 'border-t-2', 'border-[#58A6FF]');
            codeBtn.classList.add('text-[#8B949E]', 'hover:text-[#E1E4E8]');

            // Hide code-related elements with smooth transition
            const fileExplorer = document.querySelector('.w-60');
            if (fileExplorer) {
                fileExplorer.style.transition = 'transform 0.3s ease-out';
                fileExplorer.style.transform = 'translateX(-100%)';
                setTimeout(() => fileExplorer.classList.add('hidden'), 300);
            }
            
            if (terminalPanel) {
                terminalPanel.style.transition = 'transform 0.3s ease-out';
                terminalPanel.style.transform = 'translateY(100%)';
                setTimeout(() => terminalPanel.classList.add('hidden'), 300);
            }
            
            if (codeSection) {
                codeSection.classList.add('hidden');
            }
            
            // Show preview section
            if (previewSection) {
                previewSection.classList.remove('hidden');
                previewSection.classList.add('flex-1', 'w-full', 'h-full');
            }

            // Update preview content
            updatePreview();
            
            return false;
        } catch (error) {
            console.error('Error switching to preview:', error);
        }
    }

    function switchToCode() {
        // Update button states
        previewBtn.classList.remove('text-[#58A6FF]', 'bg-[#1E1E1E]', 'border-t-2', 'border-[#58A6FF]');
        previewBtn.classList.add('text-[#8B949E]', 'hover:text-[#E1E4E8]');
        
        codeBtn.classList.add('text-[#58A6FF]', 'bg-[#1E1E1E]', 'border-t-2', 'border-[#58A6FF]');
        codeBtn.classList.remove('text-[#8B949E]');

        // Cleanup Daytona workspace if needed
        if (currentSession.projectType !== 'none') {
            daytonaService.cleanup().catch(console.error);
        }

        // Show code-related elements with smooth transition
        const fileExplorer = document.querySelector('.w-60');
        fileExplorer.classList.remove('hidden');
        fileExplorer.style.transition = 'transform 0.3s ease-out';
        fileExplorer.style.transform = 'translateX(0)';
        
        terminalPanel.classList.remove('hidden');
        terminalPanel.style.transition = 'transform 0.3s ease-out';
        terminalPanel.style.transform = 'translateY(0)';
        
        codeSection.classList.remove('hidden');
        
        // Hide preview
        previewSection.classList.add('hidden');
        previewSection.classList.remove('flex-1', 'w-full', 'h-full');
        
        // Clear iframe src
        const iframe = document.getElementById('preview');
        iframe.src = '';
        iframe.srcdoc = '';
    }

    // Update preview functionality
    async function updatePreview() {
        console.log('\n=== Starting Preview Update ===');
        const iframe = document.getElementById('preview');
        const framework = currentSession.projectType;
        const previewLoading = document.getElementById('previewLoading');

        if (!iframe || !previewLoading) {
            console.error('Required preview elements not found');
            return;
        }

        try {
            previewLoading.classList.remove('hidden');

            if (framework === 'none') {
                await handleNoFrameworkPreview(iframe);
                previewLoading.classList.add('hidden');
            } else {
                console.log(`Initializing preview for ${framework} project`);
                const files = Object.fromEntries(currentSession.files);
                
                // Set up iframe load handlers before setting src
                const loadPromise = new Promise((resolve, reject) => {
                    iframe.onload = () => {
                        console.log('Iframe loaded successfully');
                        previewLoading.classList.add('hidden');
                        resolve();
                    };
                    
                    iframe.onerror = (error) => {
                        console.error('Iframe loading error:', error);
                        previewLoading.classList.add('hidden');
                        reject(error);
                    };
                });

                const previewUrl = await daytonaService.initializeWorkspace(files, framework);
                console.log('Preview URL:', previewUrl);

                // Use sandbox to prevent form submissions and page refreshes
                iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
                iframe.src = previewUrl;

                // Wait for iframe to load
                await loadPromise;
            }
        } catch (error) {
            console.error('Preview error:', error);
            logPreviewError(error, framework);
            previewLoading.classList.add('hidden');
        }
    }

    // Add this helper function for no-framework preview
    async function handleNoFrameworkPreview(iframe) {
        try {
            // Look for HTML file
            const htmlFile = Array.from(currentSession.files.entries())
                .find(([path]) => path.toLowerCase().endsWith('.html'))?.[1];
                
            const cssFile = Array.from(currentSession.files.entries())
                .find(([path]) => path.toLowerCase().endsWith('.css'))?.[1];
                
            const jsFile = Array.from(currentSession.files.entries())
                .find(([path]) => path.toLowerCase().endsWith('.js') && !path.includes('index.js'))?.[1];

            if (!htmlFile) {
                throw new Error('No HTML file found for preview');
            }

            // Create a complete HTML document
            const htmlContent = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Preview</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    ${cssFile ? `<style>${cssFile.code}</style>` : ''}
                </head>
                <body>
                    ${htmlFile.code}
                    ${jsFile ? `<script type="module">${jsFile.code}</script>` : ''}
                </body>
                </html>
            `;

            iframe.srcdoc = htmlContent;
        } catch (error) {
            console.error('Error setting preview content:', error);
            throw error;
        }
    }

    // Add event listeners for the buttons
    codeBtn.addEventListener('click', switchToCode);
    previewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        switchToPreview(e);
    }, { passive: false });

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
            config: 'javascript',
            // Add support for vanilla web files
            htm: 'html',
            mjs: 'javascript',
            cjs: 'javascript'
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
        if (!currentSession.isInitialized) {
            addBotMessage("Please generate a project first using the Generate button.");
            return;
        }

        const prompt = promptInput.value.trim();
        if (!prompt) return;

        try {
            addUserMessage(prompt);
            promptInput.value = '';
            showTypingIndicator();

            console.log('\n=== Starting Code Update ===');
            console.log('Current session:', {
                projectType: currentSession.projectType,
                filesCount: currentSession.files.size,
                lastPrompt: currentSession.lastPrompt
            });

            const response = await fetch('http://localhost:5000/api/update-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    previousPrompt: currentSession.lastPrompt,
                    projectType: currentSession.projectType,
                    files: Object.fromEntries(currentSession.files)
                })
            });

            // Handle streaming response for updates
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

                    const message = JSON.parse(line.slice(6));
                    console.log('Received message:', message);

                    switch (message.type) {
                        case 'analysis':
                            removeTypingIndicator();
                            addBotMessage(message.data.message);
                            if (message.data.message.includes('No valid files found')) {
                                addBotMessage("💡 Tip: You might need to create new files first. Try generating a new project with the required structure.");
                            }
                            break;

                        case 'update':
                            const fileData = message.data;
                            const oldFile = currentSession.files.get(fileData.path);
                            
                            // Only update and show if code has changed
                            if (!oldFile || oldFile.code !== fileData.code) {
                                console.log(`Updating file: ${fileData.path}`);
                                currentSession.files.set(fileData.path, fileData);
                                displayCode(fileData);
                                addBotMessage(`✏️ Updated ${fileData.path.split('/').pop()}`);
                            } else {
                                console.log(`No changes needed in: ${fileData.path}`);
                            }
                            break;

                        case 'complete':
                            console.log('Update complete');
                            currentSession.lastPrompt = prompt;
                            addBotMessage("✨ Changes applied successfully!");
                            break;

                        case 'error':
                            console.error('Error:', message.data.error);
                            removeTypingIndicator();
                            addBotMessage(`❌ Error: ${message.data.error}`);
                            addBotMessage("💡 Tip: Make sure your request matches the current project structure.");
                            break;
                    }
                }
            }

        } catch (error) {
            console.error('Request failed:', error);
            removeTypingIndicator();
            addBotMessage(`❌ Error: ${error.message}`);
        }
    }

    // Add this helper function to get contextual images
    function getContextualImageURL(keyword, width = 800, height = 600) {
        // List of image services we can use
        const imageServices = [
            `https://source.unsplash.com/random/${width}x${height}/?${keyword}`,
            `https://picsum.photos/${width}/${height}?${keyword}`,
            `https://placehold.co/${width}x${height}/png?text=${keyword}`
        ];
        
        return imageServices[0]; // Using Unsplash as primary source
    }

    // Helper function to log session state
    function logSessionState() {
        console.log('Current Session State:', {
            projectType: currentSession.projectType,
            filesCount: currentSession.files.size,
            isInitialized: currentSession.isInitialized,
            lastPrompt: currentSession.lastPrompt
        });
    }

    // Add this at the top of script.js
    function logPreviewError(error, context) {
        console.error(`Preview Error (${context}):`, error);
        const previewLoading = document.getElementById('previewLoading');
        const iframe = document.getElementById('preview');
        
        previewLoading?.classList.add('hidden');
        if (iframe) {
            iframe.srcdoc = `
                <div class="p-4">
                    <h2 class="text-red-500 text-xl mb-2">Preview Error</h2>
                    <p class="text-gray-700">${error.message}</p>
                    <pre class="mt-4 p-2 bg-gray-100 rounded">${context}</pre>
                </div>
            `;
        }
    }
}); 