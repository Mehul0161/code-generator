const axios = require('axios');

const GEMINI_API_KEY = 'AIzaSyDYGuO7Q2LSPUIyuKzlQKLMvj_5ltr6hAU';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function extractJSONFromResponse(response) {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\n([\s\S]*?)\n```/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
    }
    
    // If no code blocks, try parsing the response directly
    try {
        return JSON.parse(response);
    } catch (e) {
        // If both attempts fail, try to clean the response
        const cleanedResponse = response
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
        return JSON.parse(cleanedResponse);
    }
}

function getContextualImageURL(keyword, width = 800, height = 600) {
    return `https://source.unsplash.com/random/${width}x${height}/?${keyword}`;
}

async function* generateProjectInSteps(prompt, techName) {
    console.log('\n=== Starting Project Generation ===');
    try {
        // Special handling for no-framework projects
        if (techName.toLowerCase() === 'none') {
            // Simplified structure for static websites
            const staticStructure = {
                analysis: `Static website for ${prompt} using HTML, CSS, and vanilla JavaScript with Tailwind CSS for styling.`,
                structure: {
                    name: "web-project",
                    type: "directory",
                    children: [
                        {
                            name: "index.html",
                            type: "file",
                            path: "index.html",
                            purpose: "Main HTML file with Tailwind setup and structure"
                        },
                        {
                            name: "style.css",
                            type: "file",
                            path: "style.css",
                            purpose: "Custom styles with Tailwind utilities"
                        },
                        {
                            name: "script.js",
                            type: "file",
                            path: "script.js",
                            purpose: "Vanilla JavaScript for functionality"
                        }
                    ]
                }
            };

            // Send the static structure
            yield {
                type: 'structure',
                data: {
                    analysis: staticStructure.analysis,
                    files: getAllFilesFromStructure(staticStructure.structure),
                    structure: staticStructure.structure
                }
            };

            // Extract keywords for images
            const keywords = prompt.toLowerCase().split(' ')
                .filter(word => !['a', 'the', 'and', 'or', 'in', 'on', 'at'].includes(word));

            // Generate code for each file
            const files = getAllFilesFromStructure(staticStructure.structure);
            
            for (const file of files) {
                try {
                    console.log(`Generating code for: ${file.path}`);
                    const codeResponse = await axios({
                        url: GEMINI_API_URL,
                        method: "POST",
                        params: { key: GEMINI_API_KEY },
                        headers: { "Content-Type": "application/json" },
                        data: {
                            contents: [{
                                parts: [{
                                    text: `Generate code for a static webpage ${prompt}.
                                    File: ${file.path}
                                    
                                    Requirements:
                                    - Use only HTML, CSS (with Tailwind), and vanilla JavaScript
                                    - No frameworks or libraries except Tailwind CSS
                                    - Modern ES6+ JavaScript
                                    - Responsive design using Tailwind
                                    
                                    Important: When generating HTML, use relevant images from Unsplash API with this format:
                                    <img src="https://source.unsplash.com/random/800x600/?${keywords.join(',')}" 
                                         alt="Descriptive text"
                                         class="[appropriate tailwind classes]"
                                         loading="lazy"
                                    />

                                    Return ONLY the complete, working code for this file.`
                                }]
                            }]
                        }
                    });

                    yield {
                        type: 'code',
                        data: {
                            path: file.path,
                            code: codeResponse.data.candidates[0].content.parts[0].text.trim(),
                            language: getLanguageFromPath(file.path)
                        }
                    };
                } catch (error) {
                    console.error(`Failed to generate code for ${file.path}:`, error);
                    yield {
                        type: 'error',
                        data: { path: file.path, error: `Failed to generate code for ${file.path}` }
                    };
                }
            }
        } else {
            // First generate and send the structure
            console.log('1. Generating project structure');
            const structureResponse = await axios({
                url: GEMINI_API_URL,
                method: "POST",
                params: { key: GEMINI_API_KEY },
                headers: { "Content-Type": "application/json" },
                data: {
                    contents: [{
                        parts: [{
                            text: `As a software architect, analyze this ${techName} ${prompt} application and create a project structure.
                            
                            Return a JSON object in this exact format:
                            {
                                "analysis": "Brief analysis of ${prompt} application needs",
                                "structure": {
                                    "name": "root",
                                    "type": "directory",
                                    "children": [
                                        {
                                            "name": "filename",
                                            "type": "file|directory",
                                            "purpose": "Explain component purpose",
                                            "children": []
                                        }
                                    ]
                                }
                            }`
                        }]
                    }]
                }
            });

            let aiResponse;
            try {
                const responseContent = structureResponse.data.candidates[0].content.parts[0].text;
                aiResponse = extractJSONFromResponse(responseContent);
                console.log('Structure generated successfully');
                
                // Send the structure first
                yield {
                    type: 'structure',
                    data: {
                        analysis: aiResponse.analysis,
                        files: getAllFilesFromStructure(aiResponse.structure),
                        structure: aiResponse.structure
                    }
                };

                // Extract keywords for images
                const keywords = prompt.toLowerCase().split(' ')
                    .filter(word => !['a', 'the', 'and', 'or', 'in', 'on', 'at'].includes(word));

                // Then generate code for each file with image support
                console.log('2. Generating code for files');
                const files = getAllFilesFromStructure(aiResponse.structure);
                
                for (const file of files) {
                    try {
                        console.log(`Generating code for: ${file.path}`);
                        const codeResponse = await axios({
                            url: GEMINI_API_URL,
                            method: "POST",
                            params: { key: GEMINI_API_KEY },
                            headers: { "Content-Type": "application/json" },
                            data: {
                                contents: [{
                                    parts: [{
                                        text: `Generate code for a ${techName} ${prompt} application.
                                        File: ${file.path}
                                        Purpose: ${file.purpose}
                                        Analysis Context: ${aiResponse.analysis}

                                        Important: When generating HTML/JSX, use relevant images from Unsplash API with this format:
                                        <img src="https://source.unsplash.com/random/800x600/?${keywords.join(',')}" 
                                             alt="Descriptive text"
                                             class="[appropriate tailwind classes]"
                                             loading="lazy"
                                        />

                                        Ensure images are:
                                        1. Contextually relevant to the content
                                        2. Responsive using Tailwind
                                        3. Have proper alt text
                                        4. Use lazy loading
                                        5. Maintain proper aspect ratios
                                        
                                        Return ONLY the complete, working code for this file.`
                                    }]
                                }]
                            }
                        });

                        yield {
                            type: 'code',
                            data: {
                                path: file.path,
                                code: codeResponse.data.candidates[0].content.parts[0].text.trim(),
                                language: getLanguageFromPath(file.path)
                            }
                        };
                    } catch (error) {
                        console.error(`Failed to generate code for ${file.path}:`, error);
                        yield {
                            type: 'error',
                            data: {
                                path: file.path,
                                error: `Failed to generate code for ${file.path}`
                            }
                        };
                    }
                }

            } catch (error) {
                console.error('Failed to parse AI response:', error);
                throw new Error('Failed to generate project structure');
            }
        }
    } catch (error) {
        console.error('Generation Error:', error);
        yield {
            type: 'error',
            data: {
                error: error.message
            }
        };
    }
}

function getAllFilesFromStructure(node, basePath = '') {
    let files = [];
    const currentPath = basePath ? `${basePath}/${node.name}` : node.name;

    if (node.type === 'file') {
        files.push({
            path: currentPath,
            purpose: node.purpose || ''
        });
    } else if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
            files = files.concat(getAllFilesFromStructure(child, currentPath));
        }
    }
    return files;
}

function parseTreeToJSON(treeText) {
    const lines = treeText.split('\n');
    const root = {
        name: 'root',
        type: 'directory',
        children: []
    };
    
    let currentPath = [];
    let currentIndent = 0;
    let currentNode = root;
    
    for (const line of lines) {
        if (!line.trim() || line.includes('...')) continue;
        
        const indent = line.search(/\S/);
        const name = line.trim().replace(/[├─└│]/g, '').trim();
        
        if (name.endsWith('/')) {
            // It's a directory
            const dirName = name.slice(0, -1);
            const newDir = {
                name: dirName,
                type: 'directory',
                children: []
            };
            
            if (indent > currentIndent) {
                currentPath.push(currentNode);
                currentNode.children.push(newDir);
            } else if (indent === currentIndent) {
                currentPath[currentPath.length - 1].children.push(newDir);
            } else {
                while (currentPath.length > indent) {
                    currentPath.pop();
                }
                currentPath[currentPath.length - 1].children.push(newDir);
            }
            
            currentNode = newDir;
            currentIndent = indent;
        } else {
            // It's a file
            const fileNode = {
                name: name,
                type: 'file',
                path: [...currentPath.map(n => n.name), name].join('/')
            };
            
            if (currentPath.length > 0) {
                currentPath[currentPath.length - 1].children.push(fileNode);
            } else {
                root.children.push(fileNode);
            }
        }
    }
    
    return root;
}

// Update the updateCode function to use Gemini API
async function updateCode(filePath, prompt, currentCode) {
    try {
        const response = await axios({
            url: GEMINI_API_URL,
            method: "POST",
            params: {
                key: GEMINI_API_KEY
            },
            headers: {
                "Content-Type": "application/json"
            },
            data: {
                contents: [{
                    parts: [{
                        text: `Update this code based on the request: ${prompt}
                        Current code:
                        ${currentCode}
                        
                        Return only the modified parts of the code with clear markers:
                        // ... existing code ...
                        [updated code here]
                        // ... existing code ...`
                    }]
                }]
            }
        });

        return {
            type: 'update',
            data: {
                path: filePath,
                updates: response.data.candidates[0].content.parts[0].text,
                language: getLanguageFromPath(filePath)
            }
        };

    } catch (error) {
        console.error('Update Error:', error);
        return {
            type: 'error',
            error: error.message
        };
    }
}

function getLanguageFromPath(path) {
    const ext = path.split('.').pop().toLowerCase();
    const languageMap = {
        js: 'javascript',
        jsx: 'jsx',
        ts: 'typescript',
        tsx: 'tsx',
        css: 'css',
        html: 'html',
        json: 'json',
        md: 'markdown'
    };
    return languageMap[ext] || 'plaintext';
}

// Add getCode function that uses generateProjectInSteps internally
async function getCode(prompt, techName) {
    console.log('\n=== Starting Code Generation ===');
    try {
        const generator = generateProjectInSteps(prompt, techName);
        let files = [];
        let structure = null;

        // Collect all generated content
        for await (const result of generator) {
            if (result.type === 'structure') {
                structure = result.data;
            } else if (result.type === 'code') {
                files.push({
                    path: result.data.path,
                    code: result.data.code,
                    language: result.data.language
                });
            } else if (result.type === 'error') {
                throw new Error(result.data.error);
            }
        }

        return {
            files,
            structure
        };
    } catch (error) {
        console.error('❌ Code Generation Error:', error);
        throw error;
    }
}

// Export getCode along with other functions
module.exports = {
    getCode,
    generateProjectInSteps,
    updateCode
}; 