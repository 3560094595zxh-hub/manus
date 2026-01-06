const PptxGenJS = require('pptxgenjs');
const fs = require('fs');
const fetch = require('node-fetch');

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

async function main() {
    // 读取 JSON 文件
    const data = fs.readFileSync('/home/ubuntu/upload/NanoBananaPro', 'utf8');
    const slidesData = JSON.parse(data);
    
    console.log('Title:', slidesData.title);
    console.log('Slide IDs:', slidesData.slide_ids);
    console.log('Has images:', !!slidesData.images);
    console.log('Image URLs:', Object.keys(slidesData.images || {}).length);
    
    // 创建 PPTX
    const pptx = new PptxGenJS();
    pptx.title = slidesData.title || 'Manus Slides';
    pptx.author = 'Manus API Client';
    
    // 设置幻灯片尺寸 (16:9)
    pptx.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
    pptx.layout = 'LAYOUT_16x9';
    
    // 获取幻灯片图片
    const slideIds = slidesData.slide_ids || Object.keys(slidesData.images || {});
    
    for (let i = 0; i < slideIds.length; i++) {
        const slideId = slideIds[i];
        const imageUrl = slidesData.images ? slidesData.images[slideId] : null;
        
        console.log(`Processing slide ${i + 1}/${slideIds.length}: ${slideId}`);
        
        const slide = pptx.addSlide();
        
        if (imageUrl) {
            console.log(`  Downloading image...`);
            const imageBuffer = await downloadImage(imageUrl);
            
            if (imageBuffer) {
                console.log(`  Image size: ${imageBuffer.length} bytes`);
                const base64Image = imageBuffer.toString('base64');
                const imageType = imageUrl.includes('.png') ? 'png' : 'jpeg';
                
                slide.addImage({
                    data: `data:image/${imageType};base64,${base64Image}`,
                    x: 0,
                    y: 0,
                    w: '100%',
                    h: '100%',
                    sizing: { type: 'cover', w: '100%', h: '100%' }
                });
            } else {
                slide.addText(`Slide ${i + 1}: ${slideId}`, {
                    x: 0.5, y: 2.5, w: 9, h: 1,
                    fontSize: 24, align: 'center', color: '363636'
                });
            }
        } else {
            slide.addText(`Slide ${i + 1}: ${slideId}`, {
                x: 0.5, y: 2.5, w: 9, h: 1,
                fontSize: 24, align: 'center', color: '363636'
            });
        }
    }
    
    // 生成 PPTX
    console.log('\nGenerating PPTX...');
    const buffer = await pptx.write({ outputType: 'nodebuffer' });
    fs.writeFileSync('/tmp/NanoBananaPro.pptx', buffer);
    console.log(`PPTX created: /tmp/NanoBananaPro.pptx (${buffer.length} bytes)`);
}

main().catch(console.error);
