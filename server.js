const express = require('express');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Manus API 基础 URL (注意：官方文档使用 api.manus.ai)
const MANUS_API_BASE = 'https://api.manus.ai/v1';

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 文件上传配置
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB 限制
});

// 创建 uploads 目录
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// ==================== API 路由 ====================

// 创建任务
app.post('/api/create-task', async (req, res) => {
    try {
        const { api_key, prompt, task_id, agent_profile, task_mode, attachments } = req.body;
        
        if (!api_key) {
            return res.status(400).json({ error: '缺少 API Key' });
        }
        
        if (!prompt) {
            return res.status(400).json({ error: '缺少消息内容' });
        }

        // 构建请求体
        const requestBody = {
            prompt: prompt,
            agent_profile: agent_profile || 'manus-1.6-max',
            task_mode: task_mode || 'agent'
        };

        // 如果有 task_id，添加到请求体
        if (task_id) {
            requestBody.task_id = task_id;
        }

        // 如果有附件，添加到请求体
        if (attachments && attachments.length > 0) {
            requestBody.attachments = attachments;
        }

        console.log('Creating task with:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(`${MANUS_API_BASE}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json',
                'API_KEY': api_key
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Manus API error:', data);
            return res.status(response.status).json({ 
                error: data.message || data.error?.message || '创建任务失败' 
            });
        }

        console.log('Task created:', data.id);
        res.json(data);
        
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: error.message || '服务器错误' });
    }
});

// 获取任务详情
app.post('/api/get-task/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { api_key } = req.body;
        
        if (!api_key) {
            return res.status(400).json({ error: '缺少 API Key' });
        }

        console.log('Getting task:', taskId);

        const response = await fetch(`${MANUS_API_BASE}/tasks/${taskId}`, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'API_KEY': api_key
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Manus API error:', data);
            return res.status(response.status).json({ 
                error: data.message || data.error?.message || '获取任务失败' 
            });
        }

        res.json(data);
        
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ error: error.message || '服务器错误' });
    }
});

// 上传文件
app.post('/api/upload-file', upload.single('file'), async (req, res) => {
    try {
        const { api_key } = req.body;
        const file = req.file;
        
        if (!api_key) {
            return res.status(400).json({ error: '缺少 API Key' });
        }
        
        if (!file) {
            return res.status(400).json({ error: '缺少文件' });
        }

        console.log('Uploading file:', file.originalname);

        // 创建 FormData
        const formData = new FormData();
        formData.append('file', fs.createReadStream(file.path), {
            filename: file.originalname,
            contentType: file.mimetype
        });

        const response = await fetch(`${MANUS_API_BASE}/files`, {
            method: 'POST',
            headers: {
                'API_KEY': api_key,
                ...formData.getHeaders()
            },
            body: formData
        });

        // 清理临时文件
        fs.unlink(file.path, (err) => {
            if (err) console.error('Failed to delete temp file:', err);
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Manus API error:', data);
            return res.status(response.status).json({ 
                error: data.message || data.error?.message || '上传文件失败' 
            });
        }

        console.log('File uploaded:', data.id);
        res.json({
            file_id: data.id,
            filename: file.originalname
        });
        
    } catch (error) {
        console.error('Upload file error:', error);
        res.status(500).json({ error: error.message || '服务器错误' });
    }
});

// 获取文件列表
app.post('/api/list-files', async (req, res) => {
    try {
        const { api_key } = req.body;
        
        if (!api_key) {
            return res.status(400).json({ error: '缺少 API Key' });
        }

        console.log('Listing files...');

        const response = await fetch(`${MANUS_API_BASE}/files`, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'API_KEY': api_key
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('Manus API error:', data);
            return res.status(response.status).json({ 
                error: data.message || data.error?.message || '获取文件列表失败' 
            });
        }

        res.json(data);
        
    } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({ error: error.message || '服务器错误' });
    }
});

// 删除文件
app.delete('/api/delete-file/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const { api_key } = req.body;
        
        if (!api_key) {
            return res.status(400).json({ error: '缺少 API Key' });
        }

        console.log('Deleting file:', fileId);

        const response = await fetch(`${MANUS_API_BASE}/files/${fileId}`, {
            method: 'DELETE',
            headers: {
                'API_KEY': api_key
            }
        });

        if (!response.ok) {
            const data = await response.json();
            console.error('Manus API error:', data);
            return res.status(response.status).json({ 
                error: data.message || data.error?.message || '删除文件失败' 
            });
        }

        res.json({ success: true });
        
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: error.message || '服务器错误' });
    }
});

// 代理获取幻灯片 JSON 数据（解决 CORS 问题）
app.post('/api/proxy-slides', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: '缺少 URL' });
        }

        // 验证 URL 是否来自 Manus CDN
        if (!url.includes('manuscdn.com')) {
            return res.status(400).json({ error: '无效的幻灯片 URL' });
        }

        console.log('Proxying slides JSON:', url.substring(0, 100) + '...');

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Slides data loaded, title:', data.title || 'N/A');
        res.json(data);
        
    } catch (error) {
        console.error('Proxy slides error:', error);
        res.status(500).json({ error: error.message || '获取幻灯片数据失败' });
    }
});

// 代理下载文件（解决 CORS 问题）
app.get('/api/proxy-download', async (req, res) => {
    try {
        const { url, filename } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: '缺少 URL' });
        }

        // 验证 URL 是否来自 Manus CDN
        if (!url.includes('manuscdn.com')) {
            return res.status(400).json({ error: '无效的文件 URL' });
        }

        console.log('Proxying file download:', url.substring(0, 100) + '...');

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 设置响应头
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        
        if (filename) {
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        }

        // 流式传输文件内容
        response.body.pipe(res);
        
    } catch (error) {
        console.error('Proxy download error:', error);
        res.status(500).json({ error: error.message || '下载文件失败' });
    }
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 所有其他路由返回 index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 Manus API Client server running on port ${PORT}`);
    console.log(`📡 API proxy endpoint: http://localhost:${PORT}/api`);
    console.log(`🌐 Web interface: http://localhost:${PORT}`);
});
