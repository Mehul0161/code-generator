const express = require('express');
const cors = require('cors');
const previewService = require('./services/previewService');
require('dotenv').config();
const { generateProjectStructure } = require('./utils/structureGenerator');
const { getCode, generateProjectInSteps, updateCode } = require('./utils/codeGenerator');
const AIService = require('./utils/aiService');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Set up Daytona proxy endpoints
AIService.setupDaytonaProxy(app);

app.use(express.static('frontend'));

app.post('/api/generate-project', async (req, res) => {
    console.log('\n=== Starting Project Generation ===');
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const { techName, prompt } = req.body;
        console.log(`\n1. Received Request:
- Technology: ${techName}
- Prompt: ${prompt}`);
        
        // Generate project in steps
        const generator = generateProjectInSteps(prompt, techName);
        
        // Helper function to send SSE data
        const sendSSE = (data) => {
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Process each generation step
        console.log('\n2. Starting Generation Steps');
        for await (const result of generator) {
            console.log('\nSending result:', {
                type: result.type,
                dataKeys: result.data ? Object.keys(result.data) : null
            });

            // Send each piece as a separate SSE message
            sendSSE(result);
        }

        console.log('\n3. Generation Complete');
        sendSSE({ type: 'complete' });
        res.end();

    } catch (error) {
        console.error('\n❌ Error:', error);
        sendSSE({
            type: 'error',
            error: error.message
        });
        res.end();
    }
});

app.post("/api/generate", async (req, res) => {
    const { prompt, technology } = req.body;
    
    try {
        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Generate project in steps
        const generator = generateProjectInSteps(prompt, technology);
        
        for await (const result of generator) {
            // Send each piece as it's generated
            res.write(`data: ${JSON.stringify(result)}\n\n`);
        }

        res.write('data: {"type":"complete"}\n\n');
        res.end();

    } catch (error) {
        console.error("Generation Error:", error);
        res.write(`data: ${JSON.stringify({
            type: 'error',
            error: error.message
        })}\n\n`);
        res.end();
    }
});

app.post("/api/update", async (req, res) => {
    const { filePath, prompt, currentCode } = req.body;
    
    try {
        const result = await updateCode(filePath, prompt, currentCode);
        res.json(result);
    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).json({
            type: 'error',
            error: error.message
        });
    }
});

// Add new endpoint for code updates
app.post('/api/update-code', async (req, res) => {
    console.log('\n=== Starting Project Update ===');
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const { prompt, previousPrompt, projectType, files } = req.body;
        
        // Use the generator for updates
        const generator = AIService.updateProject(prompt, previousPrompt, files, projectType);
        
        for await (const result of generator) {
            res.write(`data: ${JSON.stringify(result)}\n\n`);
        }

        res.end();
    } catch (error) {
        console.error('Update Error:', error);
        res.write(`data: ${JSON.stringify({
            type: 'error',
            data: { error: error.message }
        })}\n\n`);
        res.end();
    }
});

// Preview endpoints
app.post('/api/preview', async (req, res) => {
    try {
        const { framework, files } = req.body;
        const workspaceId = await previewService.createWorkspace(files, framework);
        const previewUrl = await previewService.getPreviewUrl(workspaceId);
        res.json({ workspaceId, previewUrl });
    } catch (error) {
        console.error('Preview creation failed:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/preview/:workspaceId', async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const previewUrl = await previewService.getPreviewUrl(workspaceId);
        res.json({ previewUrl });
    } catch (error) {
        res.status(404).json({ error: 'Preview not found' });
    }
});

app.delete('/api/preview/:workspaceId', async (req, res) => {
    try {
        await previewService.cleanup(req.params.workspaceId);
        res.sendStatus(200);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve preview files
app.use('/preview', express.static(path.join(__dirname, '../previews')));

function generatePlaceholderCode(filePath, techName) {
    const ext = filePath.split('.').pop().toLowerCase();
    const fileName = filePath.split('/').pop();
    const componentName = fileName.split('.')[0];
    
    switch(ext) {
        case 'ts':
            if (fileName.includes('component')) {
                return `import { Component } from '@angular/core';

@Component({
  selector: 'app-${componentName}',
  templateUrl: './${componentName}.html',
  styleUrls: ['./${componentName}.css']
})
export class ${componentName.charAt(0).toUpperCase() + componentName.slice(1)}Component {
  // TODO: Implement component logic
}`;
            } else if (fileName.includes('service')) {
                return `import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ${componentName.charAt(0).toUpperCase() + componentName.slice(1)} {
  // TODO: Implement service methods
}`;
            } else if (fileName.includes('module')) {
                return `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }`;
            }
            return `// ${fileName}\n// TODO: Implement this file\n`;
            
        case 'html':
            return `<div class="container">
  <!-- ${fileName} template -->
</div>`;
            
        case 'css':
            return `/* ${fileName} styles */
.container {
  /* Add styles here */
}`;
            
        case 'jsx':
            if (filePath.includes('components/')) {
                return `import React from 'react';

const ${componentName} = () => {
    ${generateComponentLogic(componentName)}
    
    return (
        ${generateComponentJSX(componentName)}
    );
};

export default ${componentName};`;
            } else if (filePath.includes('pages/')) {
                return `import React from 'react';
import { useNavigate } from 'react-router-dom';
${generatePageImports(componentName)}

const ${componentName} = () => {
    const navigate = useNavigate();
    ${generatePageLogic(componentName)}
    
    return (
        <div className="page-container">
            ${generatePageJSX(componentName)}
        </div>
    );
};

export default ${componentName};`;
            }
            break;

        case 'js':
            if (fileName === 'App.js') {
                return `import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Friends from './pages/Friends';
import Notifications from './pages/Notifications';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import SearchResults from './pages/SearchResults';

function App() {
    return (
        <Router>
            <div className="flex flex-col min-h-screen bg-gray-100">
                <Navbar />
                <div className="flex flex-1 overflow-hidden">
                    <Sidebar />
                    <main className="flex-1 overflow-y-auto p-4">
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/friends" element={<Friends />} />
                            <Route path="/notifications" element={<Notifications />} />
                            <Route path="/messages" element={<Messages />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/search" element={<SearchResults />} />
                        </Routes>
                    </main>
                </div>
            </div>
        </Router>
    );
}

export default App;`;
            }
            break;

        default:
            return `// ${fileName}\n// TODO: Implement this file\n`;
    }
}

function getRandomImage(type, size = '200x200') {
    const types = {
        avatar: [
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`,
            `https://api.dicebear.com/7.x/bottts/svg?seed=${Math.random()}`,
            `https://api.dicebear.com/7.x/personas/svg?seed=${Math.random()}`
        ],
        post: [
            `https://picsum.photos/${size}?random=${Math.random()}`,
            `https://source.unsplash.com/random/${size}?social`,
            `https://source.unsplash.com/random/${size}?lifestyle`
        ],
        logo: [
            `https://api.dicebear.com/7.x/initials/svg?seed=SocialApp`,
            `https://api.dicebear.com/7.x/shapes/svg?seed=${Math.random()}`
        ]
    };
    
    const images = types[type] || types.post;
    return images[Math.floor(Math.random() * images.length)];
}

function generateComponentLogic(componentName) {
    switch(componentName) {
        case 'Post':
            return `
    const [post, setPost] = useState({
        author: {
            name: 'Sarah Parker',
            avatar: '${getRandomImage('avatar')}'
        },
        content: 'Just had an amazing time exploring the city! 🌆',
        image: '${getRandomImage('post', '600x400')}',
        likes: ${10 + Math.floor(Math.random() * 990)},
        comments: [],
        timeAgo: '2 hours ago'
    });
    
    const [likes, setLikes] = useState(post.likes);
    const [comments, setComments] = useState(post.comments);`;
        
        case 'Comment':
            return `
    const [text, setText] = useState('');
    
    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(text);
        setText('');
    };`;
        
        case 'LikeButton':
            return `
    const [isLiked, setIsLiked] = useState(false);
    
    const handleClick = () => {
        setIsLiked(prev => !prev);
        onLike();
    };`;

        case 'ShareButton':
            return `
    const handleShare = () => {
        // Implement share functionality
        console.log('Sharing post...');
    };`;

        case 'UserProfile':
            return `
    const [user, setUser] = useState({
        name: 'John Doe',
        avatar: '${getRandomImage('avatar')}',
        coverPhoto: '${getRandomImage('post', '1200x300')}',
        followers: ${1000 + Math.floor(Math.random() * 9000)},
        following: ${500 + Math.floor(Math.random() * 1500)},
        bio: 'Digital enthusiast | Photography lover | Coffee addict ☕'
    });`;

        case 'Navbar':
            return `
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    const handleSearch = (e) => {
        e.preventDefault();
        // Implement search
    };`;

        case 'Sidebar':
            return `
    const [activeItem, setActiveItem] = useState('home');
    const navigate = useNavigate();
    
    const handleNavigation = (path) => {
        setActiveItem(path);
        navigate(path);
    };`;

        case 'SearchBar':
            return `
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    
    const handleSearch = debounce((value) => {
        // Implement search logic
    }, 300);`;

        case 'Notification':
            return `
    const { id, message, time, isRead } = props;
    const [read, setRead] = useState(isRead);
    
    const markAsRead = () => setRead(true);`;

        case 'FriendRequest':
            return `
    const [status, setStatus] = useState('pending');
    
    const handleAccept = () => setStatus('accepted');
    const handleReject = () => setStatus('rejected');`;

        default:
            return `
    // Component state and logic here
    const [state, setState] = useState(null);`;
    }
}

function generateComponentJSX(componentName) {
    switch(componentName) {
        case 'Post':
            return `
        <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex items-center mb-4">
                <img src={post.author.avatar} alt={post.author.name} className="w-10 h-10 rounded-full mr-3" />
                <div>
                    <h3 className="font-semibold">{post.author.name}</h3>
                    <p className="text-sm text-gray-500">{post.timeAgo}</p>
                </div>
            </div>
            <p className="mb-4">{post.content}</p>
            {post.image && (
                <div className="mb-4 rounded-lg overflow-hidden">
                    <img src={post.image} alt="Post content" className="w-full h-auto" />
                </div>
            )}
            <div className="flex items-center space-x-4">
                <LikeButton count={likes} onLike={handleLike} />
                <CommentButton count={comments.length} />
                <ShareButton onShare={handleShare} />
            </div>
            {showComments && (
                <div className="mt-4 space-y-3">
                    {comments.map(comment => (
                        <Comment key={comment.id} {...comment} />
                    ))}
                </div>
            )}
        </div>`;

        case 'Comment':
            return `
        <div className="bg-gray-50 rounded p-3 mb-2">
            <form onSubmit={handleSubmit}>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full p-2 border rounded"
                    placeholder="Write a comment..."
                />
                <button type="submit" className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">
                    Post Comment
                </button>
            </form>
        </div>`;

        case 'LikeButton':
            return `
        <button
            onClick={handleClick}
            className={\`flex items-center space-x-1 \${isLiked ? 'text-blue-500' : 'text-gray-500'}\`}
        >
            <svg className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>{likes} likes</span>
        </button>`;

        case 'ShareButton':
            return `
        <button
            onClick={handleShare}
            className="flex items-center space-x-1 text-gray-500 hover:text-blue-500"
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>Share</span>
        </button>`;

        case 'Navbar':
            return `
        <nav className="bg-white shadow-lg fixed w-full top-0 z-50">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Logo />
                        <SearchBar />
                    </div>
                    <div className="flex items-center space-x-4">
                        <NotificationBell />
                        <UserMenu />
                    </div>
                </div>
            </div>
        </nav>`;

        case 'UserProfile':
            return `
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="h-48 overflow-hidden relative">
                <img src={user.coverPhoto} alt="Cover" className="w-full object-cover" />
            </div>
            <div className="px-4 py-3">
                <div className="flex items-center -mt-12">
                    <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-full border-4 border-white mr-4" />
                    <div className="mt-12">
                        <h2 className="text-2xl font-bold">{user.name}</h2>
                        <p className="text-gray-600">{user.bio}</p>
                    </div>
                </div>
                <div className="flex items-center mt-4 space-x-4">
                    <div className="text-center">
                        <span className="block font-bold">{user.followers.toLocaleString()}</span>
                        <span className="text-gray-600">Followers</span>
                    </div>
                    <div className="text-center">
                        <span className="block font-bold">{user.following.toLocaleString()}</span>
                        <span className="text-gray-600">Following</span>
                    </div>
                </div>
            </div>
        </div>`;

        // Add more component JSX
        default:
            return `
        <div className="component">
            {/* ${componentName} content */}
        </div>`;
    }
}

function generatePageImports(pageName) {
    switch(pageName) {
        case 'Home':
            return `
import Post from '../components/Post';
import CreatePost from '../components/CreatePost';
import Trending from '../components/Trending';`;
        
        case 'Profile':
            return `
import UserProfile from '../components/UserProfile';
import Post from '../components/Post';
import EditProfile from '../components/EditProfile';`;
        
        // Add more page imports
        default:
            return `
import { useEffect } from 'react';`;
    }
}

function generatePageLogic(pageName) {
    switch(pageName) {
        case 'Home':
            return `
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch posts
        setLoading(false);
    }, []);`;
        
        case 'Profile':
            return `
    const [profile, setProfile] = useState(null);
    const [posts, setPosts] = useState([]);

    useEffect(() => {
        // Fetch profile data
    }, []);`;
        
        // Add more page logic
        default:
            return `
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        setLoading(false);
    }, []);`;
    }
}

function generatePageJSX(pageName) {
    switch(pageName) {
        case 'Home':
            return `
            <div className="max-w-2xl mx-auto">
                <CreatePost />
                {loading ? (
                    <LoadingSpinner />
                ) : (
                    posts.map(post => (
                        <Post key={post.id} {...post} />
                    ))
                )}
            </div>`;
        
        case 'Profile':
            return `
            <div className="max-w-4xl mx-auto">
                <UserProfile {...profile} />
                <div className="mt-8">
                    {posts.map(post => (
                        <Post key={post.id} {...post} />
                    ))}
                </div>
            </div>`;
        
        // Add more page JSX
        default:
            return `
            <div className="container mx-auto p-4">
                <h1 className="text-2xl font-bold mb-4">${pageName}</h1>
                {loading ? <LoadingSpinner /> : null}
            </div>`;
    }
}

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // Start the cleanup interval
    previewService.startCleanupInterval();
}); 