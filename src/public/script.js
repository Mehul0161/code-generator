function initializeCodeGeneration() {
    const generateButton = document.getElementById('generateButton');
    const fileTree = document.getElementById('fileTree');
    const codeEditor = document.getElementById('codeEditor');
    const statusDiv = document.getElementById('status');

    generateButton.addEventListener('click', async () => {
        const prompt = document.getElementById('prompt').value;
        const technology = document.getElementById('technology').value;

        // Clear previous results
        fileTree.innerHTML = '';
        codeEditor.innerHTML = '';
        statusDiv.textContent = 'Generating...';

        // Create EventSource for SSE
        const eventSource = new EventSource(`/api/generate-project?prompt=${encodeURIComponent(prompt)}&technology=${encodeURIComponent(technology)}`);

        // Handle incoming messages
        eventSource.onmessage = (event) => {
            try {
                const result = JSON.parse(event.data);
                console.log('Received:', result);

                switch (result.type) {
                    case 'structure':
                        // Display file structure
                        displayFileStructure(result.data);
                        statusDiv.textContent = 'Generating code...';
                        break;

                    case 'code':
                        // Add or update code file
                        displayCode(result.data);
                        break;

                    case 'error':
                        statusDiv.textContent = `Error: ${result.data.error}`;
                        eventSource.close();
                        break;

                    case 'complete':
                        statusDiv.textContent = 'Generation complete!';
                        eventSource.close();
                        break;
                }
            } catch (error) {
                console.error('Error parsing message:', error);
                statusDiv.textContent = 'Error parsing server response';
                eventSource.close();
            }
        };

        // Handle connection errors
        eventSource.onerror = (error) => {
            console.error('EventSource error:', error);
            statusDiv.textContent = 'Connection error';
            eventSource.close();
        };
    });
}

function displayFileStructure(data) {
    const fileTree = document.getElementById('fileTree');
    fileTree.innerHTML = `
        <h3>Project Structure</h3>
        <div class="analysis">${data.analysis}</div>
        <div class="tree">${createTreeHTML(data.structure)}</div>
    `;
}

function createTreeHTML(node, indent = 0) {
    const indentStr = '  '.repeat(indent);
    
    if (node.type === 'file') {
        return `
            <div class="file" data-path="${node.name}">
                ${indentStr}📄 ${node.name}
            </div>
        `;
    }

    const children = node.children
        .map(child => createTreeHTML(child, indent + 1))
        .join('');

    return `
        <div class="directory">
            ${indentStr}📁 ${node.name}
            ${children}
        </div>
    `;
}

function displayCode(data) {
    const codeContainer = document.createElement('div');
    codeContainer.className = 'code-file';
    codeContainer.innerHTML = `
        <h4>${data.path}</h4>
        <pre><code class="${data.language}">${escapeHtml(data.code)}</code></pre>
    `;
    document.getElementById('codeEditor').appendChild(codeContainer);
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeCodeGeneration); 