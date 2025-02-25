const axios = require('axios');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

class AIService {
    static async validateApiKey() {
        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not set in environment variables');
        }
    }

    static async makeApiRequest(prompt) {
        await this.validateApiKey();
        
        return axios({
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
                        text: prompt
                    }]
                }]
            }
        });
    }

    static async analyzeChanges(prompt, previousPrompt, files) {
        try {
            const response = await axios({
                url: GEMINI_API_URL,
                method: "POST",
                params: { key: GEMINI_API_KEY },
                headers: { "Content-Type": "application/json" },
                data: {
                    contents: [{
                        parts: [{
                            text: `
                                Previous task: ${previousPrompt}
                                New request: ${prompt}
                                
                                Analyze the files and determine which ones need to be modified.
                                Current files: ${Object.keys(files).join(', ')}
                                
                                Return only the file paths that need updating.
                            `
                        }]
                    }]
                }
            });
            
            return response.data.candidates[0].content.parts[0].text
                .split('\n')
                .filter(line => line.trim())
                .map(line => line.trim());
        } catch (error) {
            console.error('AI Analysis Error:', error);
            throw new Error('Failed to analyze changes');
        }
    }

    static async generateCodeUpdate(prompt, file, existingCode) {
        try {
            const response = await axios({
                url: GEMINI_API_URL,
                method: "POST",
                params: { key: GEMINI_API_KEY },
                headers: { "Content-Type": "application/json" },
                data: {
                    contents: [{
                        parts: [{
                            text: `
                                Update this code based on: ${prompt}
                                File: ${file.path}
                                
                                Current code:
                                ${existingCode}
                                
                                Return ONLY the updated code.
                            `
                        }]
                    }]
                }
            });
            
            return response.data.candidates[0].content.parts[0].text.trim();
        } catch (error) {
            console.error('AI Code Update Error:', error);
            throw new Error(`Failed to update code for ${file.path}`);
        }
    }

    static async *generateInitialProject(prompt, techName) {
        try {
            console.log('\n=== Starting Initial Project Generation ===');
            yield { 
                type: 'start',
                data: { message: `🚀 Starting new ${techName} project generation...` }
            };

            // Get base structure based on framework
            const baseStructure = this.getFrameworkStructure(techName);
            console.log(`\n1. Using ${techName} base structure template`);
            
            // First generate structure with framework-specific format
            console.log('\n2. Generating project structure...');
            yield {
                type: 'progress',
                data: { message: '🔨 Analyzing requirements and creating project structure...' }
            };

            const structureResponse = await this.makeApiRequest(`
                You are a project structure generator.
                Create a ${techName} project structure for: ${prompt}

                Use this exact format for your response, no other text:
                {
                    "analysis": "Brief analysis of the project requirements",
                    "structure": ${JSON.stringify(baseStructure, null, 2)}
                }

                Modify the structure object above to match the project requirements.
                Keep the JSON format exactly as shown, with no additional text or markdown.
                The response must be valid JSON.
            `);

            let projectData;
            try {
                const responseText = structureResponse.data.candidates[0].content.parts[0].text;
                console.log('\n3. Parsing AI response...');
                
                // Clean the response text more thoroughly
                const cleanedText = responseText
                    .replace(/```json/g, '')
                    .replace(/```/g, '')
                    .replace(/^\s*{\s*/, '{') // Clean start
                    .replace(/\s*}\s*$/, '}') // Clean end
                    .replace(/,\s*([\]}])/g, '$1') // Remove trailing commas
                    .trim();
                
                console.log('Cleaned response:', cleanedText);
                
                try {
                    projectData = JSON.parse(cleanedText);
                } catch (parseError) {
                    console.error('Parse error:', parseError);
                    console.log('Attempting to fix malformed JSON...');
                    
                    // Try to extract JSON using regex
                    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        projectData = JSON.parse(jsonMatch[0]);
                    } else {
                        throw parseError;
                    }
                }

                if (!projectData || !projectData.structure) {
                    throw new Error('Invalid structure format received');
                }

                // Ensure we have the minimum required structure
                projectData.structure = {
                    ...baseStructure,
                    ...projectData.structure,
                    children: [
                        ...(baseStructure.children || []),
                        ...(projectData.structure.children || [])
                    ]
                };

                console.log('\n4. Project structure created successfully');
                yield {
                    type: 'structure',
                    data: {
                        analysis: projectData.analysis || 'Project structure generated successfully',
                        files: this.extractFilesFromStructure(projectData),
                        structure: projectData.structure
                    }
                };

                yield {
                    type: 'progress',
                    data: { message: '📁 Project structure created. Generating code for each file...' }
                };

                // Generate code for each file
                const files = this.extractFilesFromStructure(projectData);
                console.log(`\n5. Generating code for ${files.length} files...`);

                // Group files by type for more organized messaging
                let currentComponent = '';
                for (const [index, file] of files.entries()) {
                    // Log to console only
                    console.log(`\n   Generating ${file.path} (${index + 1}/${files.length})`);
                    
                    // Only yield progress messages for major components
                    const newComponent = file.path.split('/')[1]; // Get main folder (src, public, etc)
                    if (newComponent !== currentComponent) {
                        currentComponent = newComponent;
                        yield {
                            type: 'progress',
                            data: { message: `📝 Generating ${currentComponent} files...` }
                        };
                    }

                    const codeResponse = await this.generateCodeForFile(prompt, techName, file);
                    yield {
                        type: 'code',
                        data: {
                            path: file.path,
                            code: codeResponse,
                            language: this.getLanguageFromPath(file.path)
                        }
                    };
                }

                console.log('\n6. Project generation completed successfully! 🎉');
                yield {
                    type: 'progress',
                    data: { message: '✨ All files generated successfully! Your project is ready.' }
                };
                yield { type: 'complete' };

            } catch (error) {
                console.error('\n❌ Structure generation error:', error);
                console.error('Raw response:', structureResponse.data.candidates[0].content.parts[0].text);
                yield {
                    type: 'error',
                    data: { message: '❌ Failed to generate project structure: ' + error.message }
                };
                throw new Error('Failed to generate project structure');
            }
        } catch (error) {
            console.error('\n❌ Project Generation Error:', error);
            yield {
                type: 'error',
                data: { message: '❌ Project generation failed: ' + error.message }
            };
            throw error;
        }
    }

    static async *updateProject(prompt, previousPrompt, files, projectType) {
        try {
            console.log('\n=== Starting Project Update Analysis ===');
            console.log('Previous task:', previousPrompt);
            console.log('New request:', prompt);
            console.log('Project type:', projectType);
            console.log('Available files:', Object.keys(files));

            // Analyze what needs to be changed
            const analysisResponse = await this.makeApiRequest(`
                Previous task: ${previousPrompt}
                New request: ${prompt}
                Project type: ${projectType}
                
                Available files in the project:
                ${Object.keys(files).join('\n')}
                
                Important: Only return paths from the above list that need to be modified.
                Do not suggest new files that don't exist.
                Return only the exact file paths, one per line.
            `);

            const filesToUpdate = analysisResponse.data.candidates[0].content.parts[0].text
                .split('\n')
                .filter(line => line.trim())
                .map(line => line.trim())
                .filter(path => files[path]); // Only keep paths that exist

            console.log('\n=== Files to Update ===');
            console.log('Found files:', filesToUpdate);

            if (filesToUpdate.length === 0) {
                console.log('No valid files to update');
                yield {
                    type: 'analysis',
                    data: { 
                        message: '⚠️ No valid files found to implement the requested changes. Please check if you need to create new files first.' 
                    }
                };
                return;
            }

            yield {
                type: 'analysis',
                data: { 
                    message: `🔍 Analysis complete:\n${filesToUpdate.length} files will be updated` 
                }
            };

            // Update each file
            for (const filePath of filesToUpdate) {
                console.log(`\n=== Updating ${filePath} ===`);
                const file = files[filePath];
                
                if (!file) {
                    console.log(`⚠️ File not found: ${filePath}`);
                    continue;
                }

                console.log('Generating new code...');
                const codeResponse = await this.makeApiRequest(`
                    Update this code based on: ${prompt}
                    File: ${filePath}
                    Project type: ${projectType}
                    
                    Current code:
                    ${file.code}
                    
                    Important:
                    1. Return ONLY the updated code
                    2. Maintain the same file structure
                    3. Keep existing imports/exports
                    4. For CSS, use existing class names
                `);

                const newCode = codeResponse.data.candidates[0].content.parts[0].text.trim();
                
                // Only update if code has actually changed
                if (newCode !== file.code) {
                    console.log(`✓ Changes detected in ${filePath}`);
                    yield {
                        type: 'update',
                        data: {
                            path: filePath,
                            code: newCode,
                            language: this.getLanguageFromPath(filePath)
                        }
                    };
                } else {
                    console.log(`ℹ️ No changes needed in ${filePath}`);
                }
            }

            console.log('\n=== Update Complete ===');
            yield { type: 'complete' };
            
        } catch (error) {
            console.error('\n❌ Update Error:', error);
            yield {
                type: 'error',
                data: { error: error.message }
            };
        }
    }

    static async generateCodeForFile(prompt, techName, file) {
        try {
            let specificInstructions = '';
            
            if (techName === 'none') {
                switch (file.path) {
                    case 'src/index.html':
                        specificInstructions = `
                            Create an HTML file that:
                            1. Includes Tailwind CSS via CDN
                            2. Has proper meta tags and viewport settings
                            3. Links to style.css and script.js
                            4. Uses Tailwind classes for styling
                            5. Follows this prompt: ${prompt}
                            
                            Return ONLY the HTML code.
                        `;
                        break;
                        
                    case 'src/style.css':
                        specificInstructions = `
                            Create a CSS file that:
                            1. Only includes styles that can't be achieved with Tailwind
                            2. Keeps custom CSS minimal since we're using Tailwind
                            3. Follows this prompt: ${prompt}
                            
                            Return ONLY the CSS code.
                        `;
                        break;
                        
                    case 'src/script.js':
                        specificInstructions = `
                            Create a JavaScript file that:
                            1. Uses modern JavaScript (ES6+)
                            2. Handles all interactive functionality
                            3. Follows this prompt: ${prompt}
                            
                            Return ONLY the JavaScript code.
                        `;
                        break;
                }
            }

            const response = await axios({
                url: GEMINI_API_URL,
                method: "POST",
                params: { key: GEMINI_API_KEY },
                headers: { "Content-Type": "application/json" },
                data: {
                    contents: [{
                        parts: [{
                            text: specificInstructions || `
                                Generate code for a ${techName} project: ${prompt}
                                File: ${file.path}
                                Return ONLY the code.
                            `
                        }]
                    }]
                }
            });
            
            return response.data.candidates[0].content.parts[0].text.trim();
        } catch (error) {
            console.error('Code Generation Error:', error);
            throw new Error(`Failed to generate code for ${file.path}`);
        }
    }

    // Helper methods
    static getLanguageFromPath(path) {
        const ext = path.split('.').pop().toLowerCase();
        const languageMap = {
            js: 'javascript',
            jsx: 'jsx',
            ts: 'typescript',
            tsx: 'tsx',
            css: 'css',
            html: 'html',
            json: 'json'
        };
        return languageMap[ext] || 'plaintext';
    }

    static extractFilesFromStructure(data) {
        try {
            if (!data || !data.structure) {
                throw new Error('Invalid structure format');
            }

            const files = [];
            
            function traverse(node, basePath = '') {
                const currentPath = basePath ? `${basePath}/${node.name}` : node.name;

                if (node.type === 'file') {
                    files.push({
                        path: currentPath,
                        purpose: node.purpose || ''
                    });
                } else if (node.children && Array.isArray(node.children)) {
                    node.children.forEach(child => {
                        traverse(child, currentPath);
                    });
                }
            }
            
            traverse(data.structure);
            return files;
        } catch (error) {
            console.error('Error extracting files:', error);
            throw new Error('Failed to parse project structure');
        }
    }

    static getFrameworkStructure(framework) {
        const structures = {
            none: {
                name: "root",
                type: "directory",
                children: [
                    {
                        name: "src",
                        type: "directory",
                        children: [
                            { 
                                name: "index.html", 
                                type: "file", 
                                purpose: "Main HTML file with Tailwind CSS setup" 
                            },
                            { 
                                name: "style.css", 
                                type: "file", 
                                purpose: "Custom styles (if needed beyond Tailwind)" 
                            },
                            { 
                                name: "script.js", 
                                type: "file", 
                                purpose: "JavaScript functionality" 
                            }
                        ]
                    }
                ]
            },
            react: {
                name: "root",
                type: "directory",
                children: [
                    {
                        name: "public",
                        type: "directory",
                        children: [
                            { name: "index.html", type: "file", purpose: "Main HTML file" },
                            { name: "favicon.ico", type: "file", purpose: "Website favicon" },
                            { name: "manifest.json", type: "file", purpose: "PWA manifest" },
                            { name: "robots.txt", type: "file", purpose: "Search engine instructions" }
                        ]
                    },
                    {
                        name: "src",
                        type: "directory",
                        children: [
                            {
                                name: "assets",
                                type: "directory",
                                children: [
                                    { name: "images", type: "directory", children: [] },
                                    { name: "styles", type: "directory", children: [] }
                                ]
                            },
                            {
                                name: "components",
                                type: "directory",
                                children: [
                                    { name: "Header.js", type: "file", purpose: "Header component" },
                                    { name: "Footer.js", type: "file", purpose: "Footer component" },
                                    { name: "Sidebar.js", type: "file", purpose: "Sidebar component" }
                                ]
                            },
                            {
                                name: "pages",
                                type: "directory",
                                children: [
                                    { name: "Home.js", type: "file", purpose: "Home page" },
                                    { name: "About.js", type: "file", purpose: "About page" }
                                ]
                            },
                            { name: "App.js", type: "file", purpose: "Main App component" },
                            { name: "index.js", type: "file", purpose: "Entry point" },
                            { name: "styles.css", type: "file", purpose: "Global styles" }
                        ]
                    },
                    { name: ".gitignore", type: "file", purpose: "Git ignore file" },
                    { name: "package.json", type: "file", purpose: "Project configuration" },
                    { name: "README.md", type: "file", purpose: "Project documentation" }
                ]
            },
            vue: { /* Vue.js structure */ },
            angular: { /* Angular structure */ },
            next: { /* Next.js structure */ }
        };

        return structures[framework] || structures.none;
    }

    static enhanceStructure(structure, framework) {
        // Add framework-specific enhancements
        switch (framework) {
            case 'react':
                // Add React-specific files/folders
                break;
            case 'vue':
                // Add Vue-specific files/folders
                break;
            case 'angular':
                // Add Angular-specific files/folders
                break;
            case 'next':
                // Add Next.js-specific files/folders
                break;
        }
        return structure;
    }
}

module.exports = AIService; 