// Create DaytonaService class
class DaytonaService {
    constructor() {
        // Initialize without SDK for now
        this.workspace = null;
        this.apiKey = 'dtn_c62d07930c0e10e6b19ef06bd39b099c46ebdd5e0de5e79910310ee209bf8f9b';
        this.serverUrl = 'http://localhost:5000/api/preview'; // Changed to local preview endpoint
    }

    async initializeWorkspace(files, framework) {
        try {
            console.log('\n=== Initializing Preview Workspace ===');
            console.log('Framework:', framework);
            console.log('Files to process:', Object.keys(files));
            
            // Convert files map to array of file objects
            const fileArray = Object.entries(files).map(([path, file]) => ({
                path,
                content: file.code
            }));

            const response = await fetch(this.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    framework,
                    files: fileArray
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to initialize preview: ${errorText}`);
            }

            const data = await response.json();
            this.workspace = data.workspaceId;
            
            // Ensure the preview URL is absolute
            const previewUrl = new URL(data.previewUrl, window.location.origin).toString();
            console.log('Generated preview URL:', previewUrl);
            
            return previewUrl;
        } catch (error) {
            console.error('Preview initialization failed:', error);
            throw error;
        }
    }

    async cleanup() {
        if (this.workspace) {
            try {
                await fetch(`${this.serverUrl}/${this.workspace}`, {
                    method: 'DELETE'
                });
                this.workspace = null;
            } catch (error) {
                console.error('Failed to cleanup preview:', error);
            }
        }
    }
}

// Create and export instance
export const daytonaService = new DaytonaService(); 