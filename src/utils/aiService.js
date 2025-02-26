const axios = require('axios');
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

const app = express();

// Add these proxy endpoints
app.use(cors()); // Enable CORS for all routes

// Daytona workspace creation
app.post('/api/daytona-proxy', async (req, res) => {
    try {
        const { apiKey, config } = req.body;
        console.log('Creating Daytona workspace:', config);
        
        const response = await fetch('https://app.daytona.io/api/workspaces', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Daytona API error:', errorText);
            throw new Error(`Daytona API error: ${errorText}`);
        }

        const data = await response.json();
        console.log('Workspace created:', data);
        res.json(data);
    } catch (error) {
        console.error('Daytona proxy error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Daytona preview URL
app.get('/api/daytona-proxy/preview/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const response = await fetch(`https://app.daytona.io/api/workspaces/${workspaceId}/preview`);
        
        if (!response.ok) {
            throw new Error(`Failed to get preview URL: ${response.statusText}`);
        }
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Daytona workspace cleanup
app.delete('/api/daytona-proxy/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const response = await fetch(`https://app.daytona.io/api/workspaces/${workspaceId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${process.env.DAYTONA_API_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to delete workspace: ${response.statusText}`);
        }
        
        res.sendStatus(200);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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

            // First get project analysis
            const analysisResponse = await this.makeApiRequest(`
                Analyze this project request and provide a detailed breakdown:
                ${prompt}

                Return a concise but detailed description of:
                1. Main features and functionality
                2. UI/UX elements and design choices
                3. Technical components needed
                4. Key interactions and behaviors

                Format as a clear, user-friendly summary.
            `);

            const projectAnalysis = analysisResponse.data.candidates[0].content.parts[0].text;
            
            yield {
                type: 'analysis',
                data: { message: `📋 Project Analysis:\n${projectAnalysis}` }
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
            
            // First analyze the requested changes
            const changeAnalysis = await this.makeApiRequest(`
                Previous project state: ${previousPrompt}
                Requested changes: ${prompt}
                Project type: ${projectType}

                Analyze the requested changes and provide:
                1. What features/functionality will be added/modified
                2. UI/UX impacts
                3. Required code modifications
                4. Any potential challenges

                Format as a clear, user-friendly summary.
            `);

            const analysisText = changeAnalysis.data.candidates[0].content.parts[0].text;
            
            yield {
                type: 'analysis',
                data: { message: ` Change Analysis:\n${analysisText}` }
            };

            // Then get files to update
            const filesToUpdate = await this.makeApiRequest(`
                Based on this analysis:
                ${analysisText}

                Available files:
                ${Object.keys(files).join('\n')}

                Which specific files need to be modified? Return only the exact file paths, one per line.
            `);

            const filePaths = filesToUpdate.data.candidates[0].content.parts[0].text
                .split('\n')
                .filter(line => line.trim())
                .map(line => line.trim())
                .filter(path => files[path]);

            console.log('\n=== Files to Update ===');
            console.log('Found files:', filePaths);

            if (filePaths.length === 0) {
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
                    message: `🔍 Analysis complete:\n${filePaths.length} files will be updated` 
                }
            };

            // Update each file
            for (const filePath of filePaths) {
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

    static setupDaytonaProxy(app) {
        // Enable CORS for all routes
        app.use(cors());

        // Daytona workspace creation
        app.post('/api/daytona-proxy', async (req, res) => {
            try {
                const { apiKey, config } = req.body;
                console.log('Creating Daytona workspace:', config);
                
                const response = await fetch('https://app.daytona.io/api/workspaces', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(config)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Daytona API error:', errorText);
                    throw new Error(`Daytona API error: ${errorText}`);
                }

                const data = await response.json();
                console.log('Workspace created:', data);
                res.json(data);
            } catch (error) {
                console.error('Daytona proxy error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Daytona preview URL
        app.get('/api/daytona-proxy/preview/:workspaceId', async (req, res) => {
            try {
                const { workspaceId } = req.params;
                const response = await fetch(`https://app.daytona.io/api/workspaces/${workspaceId}/preview`);
                
                if (!response.ok) {
                    throw new Error(`Failed to get preview URL: ${response.statusText}`);
                }
                
                const data = await response.json();
                res.json(data);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Daytona workspace cleanup
        app.delete('/api/daytona-proxy/:workspaceId', async (req, res) => {
            try {
                const { workspaceId } = req.params;
                const response = await fetch(`https://app.daytona.io/api/workspaces/${workspaceId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${process.env.DAYTONA_API_KEY}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to delete workspace: ${response.statusText}`);
                }
                
                res.sendStatus(200);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }
}

module.exports = AIService; 