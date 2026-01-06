const express = require('express');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const PptxGenJS = require('pptxgenjs');

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

// 创建临时目录
if (!fs.existsSync('temp')) {
    fs.mkdirSync('temp');
}

// ==================== 辅助函数 ====================

// 根据 Content-Type 获取文件扩展名
function getExtensionFromContentType(contentType) {
    const mimeToExt = {
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'application/vnd.ms-powerpoint': '.ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
        'application/zip': '.zip',
        'application/x-zip-compressed': '.zip',
        'application/x-rar-compressed': '.rar',
        'application/x-7z-compressed': '.7z',
        'application/gzip': '.gz',
        'application/x-tar': '.tar',
        'text/plain': '.txt',
        'text/html': '.html',
        'text/css': '.css',
        'text/javascript': '.js',
        'application/javascript': '.js',
        'application/json': '.json',
        'text/markdown': '.md',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
        'audio/mpeg': '.mp3',
        'audio/wav': '.wav',
        'video/mp4': '.mp4',
        'video/webm': '.webm'
    };
    
    // 处理带参数的 Content-Type (如 "text/html; charset=utf-8")
    const baseMime = contentType ? contentType.split(';')[0].trim().toLowerCase() : '';
    return mimeToExt[baseMime] || '';
}

// 从 URL 提取文件扩展名
function getExtensionFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        // 解码 base64 编码的文件名部分
        const parts = pathname.split('/');
        const lastPart = parts[parts.length - 1];
        
        // 检查是否有明显的扩展名
        const extMatch = lastPart.match(/\.([a-zA-Z0-9]+)(\?|$)/);
        if (extMatch) {
            return '.' + extMatch[1].toLowerCase();
        }
        
        // 检查 URL 中是否包含文件类型信息
        if (url.includes('.pdf')) return '.pdf';
        if (url.includes('.docx')) return '.docx';
        if (url.includes('.doc')) return '.doc';
        if (url.includes('.xlsx')) return '.xlsx';
        if (url.includes('.xls')) return '.xls';
        if (url.includes('.pptx')) return '.pptx';
        if (url.includes('.ppt')) return '.ppt';
        if (url.includes('.zip')) return '.zip';
        if (url.includes('.png')) return '.png';
        if (url.includes('.jpg') || url.includes('.jpeg')) return '.jpg';
        
        return '';
    } catch (e) {
        return '';
    }
}

// 检查内容是否为 Manus 幻灯片 JSON
function isManusSlideJson(data) {
    try {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        // Manus 幻灯片 JSON 的特征
        return data && 
               (data.slide_ids || data.slides || data.files) && 
               (data.images || data.outline || data.isImageSlides !== undefined);
    } catch (e) {
        return false;
    }
}

// 下载图片并返回 Buffer
async function downloadImage(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const buffer = await response.buffer();
        return buffer;
    } catch (error) {
        console.error('Download image error:', error.message);
        return null;
    }
}

// 将 Manus 幻灯片 JSON 转换为 PPTX
async function convertSlidesToPptx(slidesData, title) {
    const pptx = new PptxGenJS();
    
    // 设置演示文稿属性
    pptx.title = title || slidesData.title || 'Manus Slides';
    pptx.author = 'Manus API Client';
    pptx.subject = 'Generated from Manus Slides';
    
    // 设置幻灯片尺寸 (16:9)
    pptx.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
    pptx.layout = 'LAYOUT_16x9';
    
    // 获取幻灯片图片 URL
    let imageUrls = [];
    
    if (slidesData.images) {
        // 使用 images 字段中的截图 URL
        const slideIds = slidesData.slide_ids || Object.keys(slidesData.images);
        for (const slideId of slideIds) {
            if (slidesData.images[slideId]) {
                imageUrls.push({
                    id: slideId,
                    url: slidesData.images[slideId],
                    title: getSlideTitle(slidesData, slideId)
                });
            }
        }
    } else if (slidesData.files) {
        // 从 files 字段提取图片 URL
        for (const file of slidesData.files) {
            const imgMatch = file.content && file.content.match(/src="([^"]+)"/);
            if (imgMatch) {
                imageUrls.push({
                    id: file.id,
                    url: imgMatch[1],
                    title: getSlideTitle(slidesData, file.id)
                });
            }
        }
    }
    
    console.log(`Converting ${imageUrls.length} slides to PPTX...`);
    
    // 为每张幻灯片创建页面
    for (let i = 0; i < imageUrls.length; i++) {
        const slideInfo = imageUrls[i];
        const slide = pptx.addSlide();
        
        try {
            // 下载图片
            console.log(`Downloading slide ${i + 1}/${imageUrls.length}...`);
            const imageBuffer = await downloadImage(slideInfo.url);
            
            if (imageBuffer) {
                // 将图片添加到幻灯片（全屏覆盖）
                const base64Image = imageBuffer.toString('base64');
                const imageType = slideInfo.url.includes('.png') ? 'png' : 'jpeg';
                
                slide.addImage({
                    data: `data:image/${imageType};base64,${base64Image}`,
                    x: 0,
                    y: 0,
                    w: '100%',
                    h: '100%',
                    sizing: { type: 'cover', w: '100%', h: '100%' }
                });
            } else {
                // 如果图片下载失败，添加占位文本
                slide.addText(`Slide ${i + 1}: ${slideInfo.title || slideInfo.id}`, {
                    x: 0.5,
                    y: 2.5,
                    w: 9,
                    h: 1,
                    fontSize: 24,
                    align: 'center',
                    color: '363636'
                });
                slide.addText('(Image could not be loaded)', {
                    x: 0.5,
                    y: 3.5,
                    w: 9,
                    h: 0.5,
                    fontSize: 14,
                    align: 'center',
                    color: '999999'
                });
            }
        } catch (error) {
            console.error(`Error processing slide ${i + 1}:`, error.message);
            // 添加错误占位
            slide.addText(`Slide ${i + 1}: Error loading content`, {
                x: 0.5,
                y: 2.5,
                w: 9,
                h: 1,
                fontSize: 24,
                align: 'center',
                color: 'CC0000'
            });
        }
    }
    
    // 如果没有幻灯片，添加一个空白页
    if (imageUrls.length === 0) {
        const slide = pptx.addSlide();
        slide.addText(title || 'Empty Presentation', {
            x: 0.5,
            y: 2.5,
            w: 9,
            h: 1,
            fontSize: 32,
            align: 'center',
            color: '363636'
        });
    }
    
    // 生成 PPTX 文件
    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' });
    return pptxBuffer;
}

// 获取幻灯片标题
function getSlideTitle(slidesData, slideId) {
    if (slidesData.outline) {
        const outlineItem = slidesData.outline.find(item => item.id === slideId);
        if (outlineItem) {
            return outlineItem.title || outlineItem.summary || slideId;
        }
    }
    return slideId;
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

// 代理下载文件（解决 CORS 问题，支持幻灯片转 PPTX）
app.get('/api/proxy-download', async (req, res) => {
    try {
        const { url, filename } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: '缺少 URL' });
        }

        // 验证 URL 是否来自 Manus CDN 或其他合法来源
        if (!url.includes('manuscdn.com') && !url.includes('manus.ai') && !url.includes('manus.im')) {
            return res.status(400).json({ error: '无效的文件 URL' });
        }

        console.log('Proxying file download:', url.substring(0, 100) + '...');
        console.log('Requested filename:', filename);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 获取 Content-Type
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        console.log('Content-Type:', contentType);
        
        // 检查是否为 JSON（可能是幻灯片数据）
        if (contentType.includes('application/json') || url.includes('c2xpZGVz')) {
            // c2xpZGVz 是 "slides" 的 base64 编码
            try {
                const jsonData = await response.json();
                
                // 检查是否为 Manus 幻灯片 JSON
                if (isManusSlideJson(jsonData)) {
                    console.log('Detected Manus slides JSON, converting to PPTX...');
                    
                    // 转换为 PPTX
                    const pptxBuffer = await convertSlidesToPptx(jsonData, filename || jsonData.title);
                    
                    // 设置响应头
                    const pptxFilename = (filename || jsonData.title || 'slides').replace(/\.[^/.]+$/, '') + '.pptx';
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
                    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(pptxFilename)}"; filename*=UTF-8''${encodeURIComponent(pptxFilename)}`);
                    res.setHeader('Content-Length', pptxBuffer.length);
                    
                    console.log('Sending PPTX file:', pptxFilename, 'Size:', pptxBuffer.length);
                    return res.send(pptxBuffer);
                }
                
                // 不是幻灯片 JSON，作为普通 JSON 文件下载
                const jsonBuffer = Buffer.from(JSON.stringify(jsonData, null, 2));
                const jsonFilename = (filename || 'data') + (filename && filename.endsWith('.json') ? '' : '.json');
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(jsonFilename)}"; filename*=UTF-8''${encodeURIComponent(jsonFilename)}`);
                return res.send(jsonBuffer);
                
            } catch (jsonError) {
                console.error('JSON parsing error:', jsonError.message);
                // 如果 JSON 解析失败，重新获取文件作为二进制
                const retryResponse = await fetch(url);
                const buffer = await retryResponse.buffer();
                res.setHeader('Content-Type', contentType);
                if (filename) {
                    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
                }
                return res.send(buffer);
            }
        }
        
        // 非 JSON 文件，直接下载
        const buffer = await response.buffer();
        
        // 确定文件扩展名
        let finalFilename = filename || 'download';
        const extFromContentType = getExtensionFromContentType(contentType);
        const extFromUrl = getExtensionFromUrl(url);
        const currentExt = path.extname(finalFilename).toLowerCase();
        
        // 如果文件名没有扩展名，添加一个
        if (!currentExt) {
            const ext = extFromContentType || extFromUrl || '';
            if (ext) {
                finalFilename += ext;
            }
        }
        
        console.log('Final filename:', finalFilename);
        
        // 设置响应头
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalFilename)}"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`);
        res.setHeader('Content-Length', buffer.length);
        
        res.send(buffer);
        
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
