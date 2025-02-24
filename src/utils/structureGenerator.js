const projectTemplates = {
    react: {
        name: 'react-project',
        type: 'directory',
        children: [
            {
                name: 'src',
                type: 'directory',
                children: [
                    {
                        name: 'components',
                        type: 'directory',
                        children: [
                            {
                                name: 'Calculator.jsx',
                                type: 'file',
                                path: 'src/components/Calculator.jsx'
                            },
                            {
                                name: 'Display.jsx',
                                type: 'file',
                                path: 'src/components/Display.jsx'
                            },
                            {
                                name: 'Button.jsx',
                                type: 'file',
                                path: 'src/components/Button.jsx'
                            },
                            {
                                name: 'Keypad.jsx',
                                type: 'file',
                                path: 'src/components/Keypad.jsx'
                            }
                        ]
                    },
                    {
                        name: 'styles',
                        type: 'directory',
                        children: [
                            {
                                name: 'Calculator.css',
                                type: 'file',
                                path: 'src/styles/Calculator.css'
                            }
                        ]
                    },
                    {
                        name: 'utils',
                        type: 'directory',
                        children: [
                            {
                                name: 'calculations.js',
                                type: 'file',
                                path: 'src/utils/calculations.js'
                            }
                        ]
                    },
                    {
                        name: 'App.js',
                        type: 'file',
                        path: 'src/App.js'
                    },
                    {
                        name: 'index.js',
                        type: 'file',
                        path: 'src/index.js'
                    }
                ]
            },
            {
                name: 'public',
                type: 'directory',
                children: [
                    {
                        name: 'index.html',
                        type: 'file',
                        path: 'public/index.html'
                    },
                    {
                        name: 'favicon.ico',
                        type: 'file',
                        path: 'public/favicon.ico'
                    }
                ]
            },
            {
                name: 'package.json',
                type: 'file',
                path: 'package.json'
            }
        ]
    },
    vue: {
        name: 'vue-project',
        type: 'directory',
        children: [
            {
                name: 'src',
                type: 'directory',
                children: [
                    {
                        name: 'components',
                        type: 'directory',
                        children: []
                    },
                    {
                        name: 'views',
                        type: 'directory',
                        children: []
                    },
                    {
                        name: 'assets',
                        type: 'directory',
                        children: [
                            {
                                name: 'styles',
                                type: 'directory',
                                children: []
                            },
                            {
                                name: 'images',
                                type: 'directory',
                                children: []
                            }
                        ]
                    },
                    {
                        name: 'router',
                        type: 'directory',
                        children: [
                            {
                                name: 'index.js',
                                type: 'file',
                                path: 'src/router/index.js'
                            }
                        ]
                    },
                    {
                        name: 'store',
                        type: 'directory',
                        children: [
                            {
                                name: 'index.js',
                                type: 'file',
                                path: 'src/store/index.js'
                            }
                        ]
                    },
                    {
                        name: 'App.vue',
                        type: 'file',
                        path: 'src/App.vue'
                    },
                    {
                        name: 'main.js',
                        type: 'file',
                        path: 'src/main.js'
                    }
                ]
            },
            {
                name: 'public',
                type: 'directory',
                children: [
                    {
                        name: 'index.html',
                        type: 'file',
                        path: 'public/index.html'
                    },
                    {
                        name: 'favicon.ico',
                        type: 'file',
                        path: 'public/favicon.ico'
                    }
                ]
            },
            {
                name: 'package.json',
                type: 'file',
                path: 'package.json'
            }
        ]
    },
    angular: {
        name: 'angular-project',
        type: 'directory',
        children: [
            {
                name: 'src',
                type: 'directory',
                children: [
                    {
                        name: 'app',
                        type: 'directory',
                        children: [
                            {
                                name: 'components',
                                type: 'directory',
                                children: []
                            },
                            {
                                name: 'pages',
                                type: 'directory',
                                children: []
                            },
                            {
                                name: 'services',
                                type: 'directory',
                                children: [
                                    {
                                        name: 'api.service.ts',
                                        type: 'file',
                                        path: 'src/app/services/api.service.ts'
                                    }
                                ]
                            },
                            {
                                name: 'app.component.ts',
                                type: 'file',
                                path: 'src/app/app.component.ts'
                            },
                            {
                                name: 'app.component.html',
                                type: 'file',
                                path: 'src/app/app.component.html'
                            },
                            {
                                name: 'app.component.css',
                                type: 'file',
                                path: 'src/app/app.component.css'
                            },
                            {
                                name: 'app.module.ts',
                                type: 'file',
                                path: 'src/app/app.module.ts'
                            },
                            {
                                name: 'app-routing.module.ts',
                                type: 'file',
                                path: 'src/app/app-routing.module.ts'
                            }
                        ]
                    }
                ]
            },
            {
                name: 'angular.json',
                type: 'file',
                path: 'angular.json'
            },
            {
                name: 'package.json',
                type: 'file',
                path: 'package.json'
            },
            {
                name: 'tsconfig.json',
                type: 'file',
                path: 'tsconfig.json'
            },
            {
                name: 'README.md',
                type: 'file',
                path: 'README.md'
            },
            {
                name: '.gitignore',
                type: 'file',
                path: '.gitignore'
            }
        ]
    },
    next: {
        name: 'next-project',
        type: 'directory',
        children: [
            {
                name: 'src',
                type: 'directory',
                children: [
                    {
                        name: 'app',
                        type: 'directory',
                        children: [
                            {
                                name: 'layout.tsx',
                                type: 'file',
                                path: 'src/app/layout.tsx'
                            },
                            {
                                name: 'page.tsx',
                                type: 'file',
                                path: 'src/app/page.tsx'
                            }
                        ]
                    },
                    {
                        name: 'components',
                        type: 'directory',
                        children: []
                    },
                    {
                        name: 'lib',
                        type: 'directory',
                        children: []
                    },
                    {
                        name: 'styles',
                        type: 'directory',
                        children: [
                            {
                                name: 'globals.css',
                                type: 'file',
                                path: 'src/styles/globals.css'
                            }
                        ]
                    }
                ]
            },
            {
                name: 'public',
                type: 'directory',
                children: []
            },
            {
                name: 'next.config.js',
                type: 'file',
                path: 'next.config.js'
            },
            {
                name: 'package.json',
                type: 'file',
                path: 'package.json'
            },
            {
                name: 'tsconfig.json',
                type: 'file',
                path: 'tsconfig.json'
            }
        ]
    }
};

async function generateProjectStructure(techName, prompt) {
    try {
        console.log('\n=== Generating Project Structure ===');
        
        // Get the template based on technology
        const template = projectTemplates[techName.toLowerCase()];
        if (!template) {
            throw new Error(`No template found for technology: ${techName}`);
        }

        // Customize the template based on the prompt if needed
        const structure = customizeTemplate(template, prompt);
        
        return {
            structure: structure,
            files: getAllFiles(structure)
        };
    } catch (error) {
        console.error('Structure Generation Error:', error);
        throw error;
    }
}

function customizeTemplate(template, prompt) {
    // Deep clone the template to avoid modifying the original
    const structure = JSON.parse(JSON.stringify(template));
    
    // Add any prompt-specific customization here
    // For example, adding specific components based on the prompt
    
    return structure;
}

function getAllFiles(structure) {
    const files = [];

    function traverse(node, currentPath = '') {
        if (node.type === 'file') {
            files.push({
                path: node.path || `${currentPath}${node.name}`,
                type: node.name.split('.').pop()
            });
        } else if (node.children) {
            for (const child of node.children) {
                traverse(child, `${currentPath}${node.name}/`);
            }
        }
    }

    traverse(structure);
    return files;
}

function getFileExtension(tech) {
    switch (tech) {
        case 'vue':
            return '.vue';
        case 'react':
            return '.jsx';
        case 'angular':
            return '.component.ts';
        default:
            return '.js';
    }
}

module.exports = { generateProjectStructure }; 