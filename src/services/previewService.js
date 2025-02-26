const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

class PreviewService {
    constructor() {
        this.previewDir = path.join(__dirname, '../../previews');
        this.workspaces = new Map();
        
        // Ensure preview directory exists
        fs.ensureDirSync(this.previewDir);
    }

    async createWorkspace(files, framework) {
        const workspaceId = uuidv4();
        const workspacePath = path.join(this.previewDir, workspaceId);

        try {
            console.log('Creating workspace:', { workspaceId, framework });
            
            // Create workspace directory
            await fs.ensureDir(workspacePath);

            // Write files
            for (const file of files) {
                const { path: filePath, content } = file;
                console.log(`Writing file: ${filePath}`);
                
                // Ensure content is a string
                const fileContent = typeof content === 'string' ? content : 
                    (content.code ? content.code.toString() : '');
                
                // Clean markdown code blocks if present
                const cleanContent = fileContent
                    .replace(/```[a-z]*\n/g, '')
                    .replace(/```$/g, '')
                    .trim();

                const fullPath = path.join(workspacePath, filePath);
                await fs.ensureDir(path.dirname(fullPath));
                await fs.writeFile(fullPath, cleanContent, 'utf8');
            }

            // Initialize npm project if needed
            if (framework !== 'none') {
                await this.initializeProject(workspacePath, framework);
            }

            this.workspaces.set(workspaceId, {
                path: workspacePath,
                framework,
                created: Date.now()
            });

            return workspaceId;
        } catch (error) {
            console.error('Workspace creation error:', error);
            await fs.remove(workspacePath).catch(console.error);
            throw error;
        }
    }

    async initializeProject(workspacePath, framework) {
        // Add package.json for framework projects
        const packageJson = {
            name: 'preview-project',
            version: '1.0.0',
            private: true,
            scripts: {
                start: framework === 'react' ? 'react-scripts start' : 'vite'
            },
            dependencies: this.getDependencies(framework),
            devDependencies: this.getDevDependencies(framework)
        };

        await fs.writeFile(
            path.join(workspacePath, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );
    }

    getDependencies(framework) {
        const deps = {
            react: {
                'react': '^18.2.0',
                'react-dom': '^18.2.0',
                'react-scripts': '5.0.1'
            },
            vue: {
                'vue': '^3.3.0',
                '@vitejs/plugin-vue': '^4.5.0'
            }
        };
        return deps[framework] || {};
    }

    getDevDependencies(framework) {
        const devDeps = {
            react: {
                '@babel/plugin-proposal-private-property-in-object': '^7.21.11'
            },
            vue: {
                'vite': '^5.0.0'
            }
        };
        return devDeps[framework] || {};
    }

    async getPreviewUrl(workspaceId) {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace) {
            throw new Error('Workspace not found');
        }
        return `/preview/${workspaceId}/index.html`;
    }

    async cleanup(workspaceId) {
        const workspace = this.workspaces.get(workspaceId);
        if (workspace) {
            await fs.remove(workspace.path);
            this.workspaces.delete(workspaceId);
        }
    }

    // Clean up old workspaces periodically
    startCleanupInterval() {
        setInterval(() => {
            const now = Date.now();
            for (const [id, workspace] of this.workspaces.entries()) {
                if (now - workspace.created > 30 * 60 * 1000) { // 30 minutes
                    this.cleanup(id).catch(console.error);
                }
            }
        }, 5 * 60 * 1000); // Check every 5 minutes
    }
}

module.exports = new PreviewService(); 